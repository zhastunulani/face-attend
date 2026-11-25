package kz.zhastunulani.faceattend.kiosk

import android.app.admin.DeviceAdminReceiver
import android.content.ComponentName
import android.content.Context

/**
 * Device owner ретінде тағайындалса (adb арқылы), қолданба толық киоск режиміне өтеді:
 * «Артқа», «Үй», «Соңғы қолданбалар» батырмалары бұғатталады.
 */
class KioskAdminReceiver : DeviceAdminReceiver() {
    companion object {
        fun component(context: Context) = ComponentName(context, KioskAdminReceiver::class.java)
    }
}
