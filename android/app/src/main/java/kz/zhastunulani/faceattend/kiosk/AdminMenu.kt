package kz.zhastunulani.faceattend.kiosk

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.text.InputType
import android.webkit.WebView
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AlertDialog

/** Жасырын әкімші мәзірі (PIN-кодпен қорғалған). */
class AdminMenu(private val a: MainActivity) {

    /** Әкімші баптауларға шыққанда device owner бекітуін уақытша қайта қоспау үшін */
    var unlockedForService = false
        private set

    fun open() {
        val p = a.prefs
        val now = System.currentTimeMillis()
        if (p.lockedUntil > now) {
            toast("Тым көп қате әрекет. ${(p.lockedUntil - now) / 1000 + 1} с күтіңіз")
            return
        }
        if (!p.hasPin) askNewPin(first = true) { showMenu() } else askPin { showMenu() }
    }

    // ==================== PIN ====================

    private fun pinField(hint: String) = EditText(a).apply {
        this.hint = hint
        inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
    }

    private fun box(vararg fields: EditText) = LinearLayout(a).apply {
        orientation = LinearLayout.VERTICAL
        val pad = (20 * a.resources.displayMetrics.density).toInt()
        setPadding(pad, pad / 2, pad, 0)
        fields.forEach { addView(it) }
    }

    private fun askPin(onOk: () -> Unit) {
        val f = pinField("PIN-код")
        AlertDialog.Builder(a)
            .setTitle("Әкімші режимі")
            .setView(box(f))
            .setPositiveButton("Кіру") { _, _ ->
                val p = a.prefs
                if (p.checkPin(f.text.toString())) {
                    p.failedAttempts = 0
                    onOk()
                } else {
                    p.failedAttempts += 1
                    if (p.failedAttempts >= 5) {
                        p.lockedUntil = System.currentTimeMillis() + 60_000
                        p.failedAttempts = 0
                        toast("PIN қате. 1 минутқа бұғатталды")
                    } else toast("PIN қате")
                }
            }
            .setNegativeButton("Болдырмау", null)
            .show()
    }

    private fun askNewPin(first: Boolean, onOk: () -> Unit) {
        val f1 = pinField("Жаңа PIN (4–8 сан)")
        val f2 = pinField("PIN-ді қайталаңыз")
        AlertDialog.Builder(a)
            .setTitle(if (first) "Әкімші PIN-кодын орнатыңыз" else "PIN-кодты өзгерту")
            .setMessage(if (first) "Бұл код жасырын мәзірге кіру үшін керек. Оны ұмытпаңыз." else null)
            .setView(box(f1, f2))
            .setPositiveButton("Сақтау") { _, _ ->
                val pin = f1.text.toString()
                when {
                    !Regex("^\\d{4,8}$").matches(pin) -> toast("PIN 4–8 саннан тұруы керек")
                    pin != f2.text.toString() -> toast("PIN сәйкес келмейді")
                    else -> {
                        a.prefs.setPin(pin)
                        toast("PIN сақталды")
                        onOk()
                    }
                }
            }
            .setNegativeButton("Болдырмау", null)
            .show()
    }

    // ==================== Мәзір ====================

    private fun showMenu() {
        unlockedForService = false
        val items = mutableListOf<Pair<String, () -> Unit>>(
            "Сканерлеу бетін қайта жүктеу" to { a.loadScan() },
            "Жүйеге кіру / киоскіні тіркеу" to { a.loadLogin() },
            "Сервер мекенжайы" to { editServer() },
            "PIN-кодты өзгерту" to { askNewPin(first = false) {} },
            (if (a.isLocked) "Экран бекітуін алу" else "Экранды бекіту (басқа қолданбаға шықпау)") to { toggleLock() },
            "Android баптаулары" to { openSettings() },
            "Ақпарат" to { showInfo() },
        )
        if (a.isDeviceOwner) items += "Толық киоск режимін өшіру (device owner)" to { removeOwner() }
        items += "Қолданбадан шығу" to { exitApp() }

        AlertDialog.Builder(a)
            .setTitle("FaceAttend Киоск · ${BuildConfig.VERSION_NAME}")
            .setItems(items.map { it.first }.toTypedArray()) { _, i -> items[i].second() }
            .setNegativeButton("Жабу", null)
            .show()
    }

    private fun editServer() {
        val f = EditText(a).apply {
            setText(a.prefs.serverUrl)
            inputType = InputType.TYPE_TEXT_VARIATION_URI
        }
        AlertDialog.Builder(a)
            .setTitle("Сервер мекенжайы")
            .setView(box(f))
            .setPositiveButton("Сақтау") { _, _ ->
                val url = f.text.toString().trim().trimEnd('/')
                val uri = Uri.parse(url)
                if (uri.scheme != "https" || uri.host.isNullOrBlank()) {
                    toast("Мекенжай https:// деп басталуы керек")
                } else {
                    a.prefs.serverUrl = url
                    a.loadScan()
                }
            }
            .setNeutralButton("Әдепкі") { _, _ ->
                a.prefs.serverUrl = BuildConfig.DEFAULT_SERVER
                a.loadScan()
            }
            .setNegativeButton("Болдырмау", null)
            .show()
    }

    private fun toggleLock() {
        if (a.isLocked) {
            unlockedForService = true
            runCatching { a.stopLockTask() }
            toast("Экран бекітуі алынды")
        } else {
            unlockedForService = false
            // Device owner болмаса Android «экранды бекіту» растауын сұрайды
            runCatching { a.startLockTask() }.onFailure { toast("Бекіту мүмкін болмады") }
        }
    }

    private fun openSettings() {
        unlockedForService = true
        runCatching { a.stopLockTask() }
        a.startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun showInfo() {
        val webView = WebView.getCurrentWebViewPackage()
        AlertDialog.Builder(a)
            .setTitle("Ақпарат")
            .setMessage(
                """
                Нұсқа: ${BuildConfig.VERSION_NAME}
                Сервер: ${a.prefs.serverUrl}
                Толық киоск (device owner): ${if (a.isDeviceOwner) "иә" else "жоқ"}
                Экран бекітілген: ${if (a.isLocked) "иә" else "жоқ"}
                Android: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})
                Құрылғы: ${Build.MANUFACTURER} ${Build.MODEL}
                WebView: ${webView?.versionName ?: "?"}
                """.trimIndent()
            )
            .setPositiveButton("OK", null)
            .show()
    }

    private fun removeOwner() {
        AlertDialog.Builder(a)
            .setTitle("Толық киоск режимін өшіру?")
            .setMessage("Қолданба device owner құқығынан бас тартады. Кейін қайта қосу үшін adb керек болады.")
            .setPositiveButton("Өшіру") { _, _ ->
                unlockedForService = true
                runCatching { a.stopLockTask() }
                @Suppress("DEPRECATION")
                runCatching { a.dpm.clearDeviceOwnerApp(a.packageName) }
                    .onSuccess { toast("Device owner өшірілді") }
                    .onFailure { toast("Өшіру мүмкін болмады: ${it.message}") }
            }
            .setNegativeButton("Болдырмау", null)
            .show()
    }

    private fun exitApp() {
        unlockedForService = true
        runCatching { a.stopLockTask() }
        a.finishAndRemoveTask()
    }

    private fun toast(msg: String) = Toast.makeText(a, msg, Toast.LENGTH_LONG).show()
}
