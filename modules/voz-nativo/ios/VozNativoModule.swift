import AVFoundation
import ExpoModulesCore
import WebRTC

/// Sesión de audio de la voz: `playAndRecord` que se MEZCLA con las demás apps (el juego no se silencia) y que se
/// reactiva cuando termina una interrupción. Se aplica a través de `RTCAudioSession`, porque es la sesión que usa el
/// motor de audio de WebRTC; tocar `AVAudioSession` por fuera lo dejaría desincronizado.
public class VozNativoModule: Module {
  private var observador: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("VozNativo")

    Events("onColgar", "onInterrupcion")

    Function("configurarAudio") {
      Self.aplicar()
    }

    // Solo Android; aquí no hacen nada para que la API sea la misma.
    Function("iniciarServicio") { (_: String, _: String, _: String) in }
    Function("pararServicio") {}

    OnCreate {
      self.observador = NotificationCenter.default.addObserver(
        forName: AVAudioSession.interruptionNotification,
        object: AVAudioSession.sharedInstance(),
        queue: .main
      ) { [weak self] aviso in
        guard
          let crudo = aviso.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          AVAudioSession.InterruptionType(rawValue: crudo) == .ended
        else { return }
        Self.aplicar()
        self?.sendEvent("onInterrupcion", ["fin": true])
      }
    }

    OnDestroy {
      if let o = self.observador { NotificationCenter.default.removeObserver(o) }
    }
  }

  static func configuracion() -> RTCAudioSessionConfiguration {
    let c = RTCAudioSessionConfiguration.webRTC()
    c.category = AVAudioSession.Category.playAndRecord.rawValue
    c.categoryOptions = [.mixWithOthers, .allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker]
    c.mode = AVAudioSession.Mode.voiceChat.rawValue
    return c
  }

  static func aplicar() {
    let c = configuracion()
    // La que usará WebRTC cada vez que active el audio…
    RTCAudioSessionConfiguration.setWebRTC(c)
    // …y la sesión actual, por si ya estaba activa.
    let sesion = RTCAudioSession.sharedInstance()
    sesion.lockForConfiguration()
    defer { sesion.unlockForConfiguration() }
    do {
      try sesion.setConfiguration(c, active: true)
    } catch {
      NSLog("[voz] no se pudo aplicar la sesión de audio: \(error.localizedDescription)")
    }
  }
}
