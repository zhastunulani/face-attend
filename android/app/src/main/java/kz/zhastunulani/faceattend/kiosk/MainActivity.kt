package kz.zhastunulani.faceattend.kiosk

import android.Manifest
import android.annotation.SuppressLint
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Есік алдындағы киоск: тек FaceAttend сканерлеу беті (WebView).
 * Жасырын әкімші мәзірі — сайттағы логотипті 8 рет басу (JS көпірі арқылы)
 * немесе байланыс жоқ экранындағы логотипті 8 рет басу.
 */
class MainActivity : AppCompatActivity() {

    lateinit var prefs: Prefs
    lateinit var web: WebView
    private lateinit var offline: View
    private lateinit var offlineText: TextView
    private lateinit var admin: AdminMenu

    private val handler = Handler(Looper.getMainLooper())
    private var pendingPermission: PermissionRequest? = null
    private var loadedAt = 0L
    private var offlineShown = false

    private val serverHost: String? get() = Uri.parse(prefs.serverUrl).host

    private val cameraPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val req = pendingPermission ?: return@registerForActivityResult
        pendingPermission = null
        if (granted) req.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else req.deny()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        admin = AdminMenu(this)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = WebView(this)
        offline = buildOfflineView()
        setContentView(FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0E3449"))
            addView(web, FrameLayout.LayoutParams(MATCH, MATCH))
            addView(offline, FrameLayout.LayoutParams(MATCH, MATCH))
        })
        setupWebView()

        // «Артқа»: кіру бетінде болса — сканерге қайту, әйтпесе ештеңе жасамау
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.url?.contains("/scan") != true) loadScan()
            }
        })

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            registerForActivityResult(ActivityResultContracts.RequestPermission()) { loadScan() }
                .launch(Manifest.permission.CAMERA)
        } else {
            loadScan()
        }
        handler.post(watchdog)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, false)
        }
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false // дауыстық нұсқаулар басусыз ойнайды
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(false)
            userAgentString = "$userAgentString FaceAttendKiosk/${BuildConfig.VERSION_NAME}"
        }
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.addJavascriptInterface(Bridge(), "FaceAttendApp")

        web.webViewClient = object : WebViewClient() {
            // Тек өз серверіміз; басқа сайттарға өту бұғатталады
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                request.url.host != serverHost

            override fun onPageFinished(view: WebView, url: String) {
                if (!offlineShown) offline.visibility = View.GONE
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showOffline("Серверге қосылу мүмкін болмады.\nҚайта қосылуда…")
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val ours = request.origin.host == serverHost
                    val wantsCamera = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                    when {
                        !ours || !wantsCamera -> request.deny()
                        hasCamera() -> request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                        else -> {
                            pendingPermission = request
                            cameraPermission.launch(Manifest.permission.CAMERA)
                        }
                    }
                }
            }
        }
    }

    private fun hasCamera() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    fun loadScan() = load("${prefs.serverUrl}/scan")

    fun loadLogin() = load("${prefs.serverUrl}/login?redirect=/scan")

    private fun load(url: String) {
        offlineShown = false
        loadedAt = SystemClock.elapsedRealtime()
        web.loadUrl(url)
    }

    private fun showOffline(message: String) {
        offlineShown = true
        offlineText.text = message
        offline.visibility = View.VISIBLE
    }

    /**
     * Күзетші: байланыс жоқ болса 15 с сайын қайта жүктейді;
     * тәулік бойы жұмыс істейтін бетті 12 сағат сайын жаңартады (жады ағуынан қорғау).
     */
    private val watchdog = object : Runnable {
        override fun run() {
            val age = SystemClock.elapsedRealtime() - loadedAt
            if (offlineShown && age > 15_000) loadScan()
            else if (age > 12 * 60 * 60 * 1000L && web.url?.contains("/scan") == true) loadScan()
            handler.postDelayed(this, 15_000)
        }
    }

    // ==================== Толық экран және киоск режимі ====================

    override fun onResume() {
        super.onResume()
        web.onResume()
        hideSystemBars()
        startKioskLockIfOwner()
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        web.onPause()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        web.destroy()
        super.onDestroy()
    }

    private fun hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    val dpm: DevicePolicyManager get() = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    val isDeviceOwner: Boolean get() = dpm.isDeviceOwnerApp(packageName)

    val isLocked: Boolean
        get() = (getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).lockTaskModeState !=
            ActivityManager.LOCK_TASK_MODE_NONE

    /** Device owner болса — экранды үнсіз бекітеміз (батырмалар жұмыс істемейді) */
    private fun startKioskLockIfOwner() {
        if (!isDeviceOwner || admin.unlockedForService) return
        dpm.setLockTaskPackages(KioskAdminReceiver.component(this), arrayOf(packageName))
        if (!isLocked) runCatching { startLockTask() }
    }

    // ==================== JS көпірі ====================

    inner class Bridge {
        /** Сайттағы логотипті 8 рет басқанда шақырылады */
        @JavascriptInterface
        fun openAdmin() = runOnUiThread { admin.open() }

        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME
    }

    // ==================== Байланыс жоқ экраны ====================

    private fun buildOfflineView(): View {
        val dp = resources.displayMetrics.density
        var taps = 0
        var lastTap = 0L
        val logo = ImageView(this).apply {
            setImageResource(R.mipmap.ic_launcher)
            layoutParams = LinearLayout.LayoutParams((72 * dp).toInt(), (72 * dp).toInt())
            // Байланыс жоқ кезде де әкімші мәзіріне кіруге болады (8 рет басу)
            setOnClickListener {
                val now = SystemClock.elapsedRealtime()
                taps = if (now - lastTap < 2500) taps + 1 else 1
                lastTap = now
                if (taps >= 8) { taps = 0; admin.open() }
            }
        }
        offlineText = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
            setPadding(0, (24 * dp).toInt(), 0, (16 * dp).toInt())
        }
        val title = TextView(this).apply {
            text = "FaceAttend"
            setTextColor(Color.WHITE)
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, (16 * dp).toInt(), 0, 0)
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0E3449"))
            isClickable = true
            addView(logo)
            addView(title)
            addView(offlineText)
            addView(ProgressBar(this@MainActivity))
            offlineText.text = "Жүктелуде…"
        }
    }

    companion object {
        private const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
    }
}
