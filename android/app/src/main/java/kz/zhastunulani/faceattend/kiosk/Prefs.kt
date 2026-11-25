package kz.zhastunulani.faceattend.kiosk

import android.content.Context
import java.security.MessageDigest
import java.security.SecureRandom

/** Киоск баптаулары: сервер мекенжайы және әкімші PIN-коды (тек хэші сақталады). */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("kiosk", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = sp.getString("server", null) ?: BuildConfig.DEFAULT_SERVER
        set(v) = sp.edit().putString("server", v.trimEnd('/')).apply()

    val hasPin: Boolean get() = sp.contains("pin_hash")

    fun setPin(pin: String) {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }
        sp.edit().putString("pin_salt", salt).putString("pin_hash", hash(salt, pin)).apply()
    }

    fun checkPin(pin: String): Boolean {
        val salt = sp.getString("pin_salt", null) ?: return false
        val expected = sp.getString("pin_hash", null) ?: return false
        return MessageDigest.isEqual(expected.toByteArray(), hash(salt, pin).toByteArray())
    }

    /** Қате PIN-дан кейінгі бұғаттау (тырнақ-тырнақ теруден қорғау) */
    var failedAttempts: Int
        get() = sp.getInt("pin_failed", 0)
        set(v) = sp.edit().putInt("pin_failed", v).apply()

    var lockedUntil: Long
        get() = sp.getLong("pin_locked_until", 0)
        set(v) = sp.edit().putLong("pin_locked_until", v).apply()

    private fun hash(salt: String, pin: String): String =
        MessageDigest.getInstance("SHA-256").digest("$salt:$pin".toByteArray())
            .joinToString("") { "%02x".format(it) }
}
