package minetoy.voznativo

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Servicio en primer plano de tipo micrófono: mientras está vivo, Android deja que la app siga capturando y reproduciendo
 * audio con otra app (Minecraft) delante. Solo muestra la notificación fija; el audio lo lleva WebRTC.
 * No pide foco de audio, así que el juego sigue sonando.
 */
class ServicioVoz : Service() {
  companion object {
    const val TITULO = "titulo"
    const val TEXTO = "texto"
    const val COLGAR_TEXTO = "colgar"
    private const val ACCION_COLGAR = "minetoy.voznativo.COLGAR"
    private const val CANAL = "voz"
    private const val ID = 1

    /** Lo pone el módulo: avisa a JS para que cierre la conexión de voz. */
    @Volatile var alColgar: (() -> Unit)? = null
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACCION_COLGAR) {
      alColgar?.invoke()
      ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }
    val titulo = intent?.getStringExtra(TITULO) ?: "MineToy"
    val texto = intent?.getStringExtra(TEXTO) ?: ""
    val colgar = intent?.getStringExtra(COLGAR_TEXTO) ?: "Colgar"

    val gestor = getSystemService(NotificationManager::class.java)
    if (gestor.getNotificationChannel(CANAL) == null) {
      gestor.createNotificationChannel(NotificationChannel(CANAL, titulo, NotificationManager.IMPORTANCE_LOW))
    }
    val abrir = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val accionColgar = PendingIntent.getService(
      this, 1, Intent(this, ServicioVoz::class.java).setAction(ACCION_COLGAR), PendingIntent.FLAG_IMMUTABLE,
    )
    val aviso = NotificationCompat.Builder(this, CANAL)
      .setContentTitle(titulo)
      .setContentText(texto)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setContentIntent(abrir)
      .addAction(0, colgar, accionColgar)
      .build()
    val tipo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
    ServiceCompat.startForeground(this, ID, aviso, tipo)
    return START_NOT_STICKY
  }
}
