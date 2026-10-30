package minetoy.voznativo

import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Arranca y para el servicio en primer plano de la voz y avisa a JS cuando se pulsa «Colgar» en la notificación. */
class VozNativoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VozNativo")

    Events("onColgar", "onInterrupcion")

    // Solo iOS; aquí no hace nada para que la API sea la misma.
    Function("configurarAudio") {}

    Function("iniciarServicio") { titulo: String, texto: String, colgar: String ->
      appContext.reactContext?.let { ctx ->
        val intent = Intent(ctx, ServicioVoz::class.java)
          .putExtra(ServicioVoz.TITULO, titulo)
          .putExtra(ServicioVoz.TEXTO, texto)
          .putExtra(ServicioVoz.COLGAR_TEXTO, colgar)
        ContextCompat.startForegroundService(ctx, intent)
      }
      Unit
    }

    Function("pararServicio") {
      appContext.reactContext?.let { ctx -> ctx.stopService(Intent(ctx, ServicioVoz::class.java)) }
      Unit
    }

    OnCreate {
      ServicioVoz.alColgar = { sendEvent("onColgar", emptyMap<String, Any>()) }
    }

    OnDestroy {
      ServicioVoz.alColgar = null
    }
  }
}
