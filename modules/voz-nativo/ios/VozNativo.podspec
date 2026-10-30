Pod::Spec.new do |s|
  s.name           = 'VozNativo'
  s.version        = '0.1.0'
  s.summary        = 'Sesión de audio de la voz de MineToy'
  s.description    = 'Sesión de audio que mezcla con el juego y la reactiva tras interrupciones.'
  s.license        = { :type => 'Propietaria' }
  s.author         = 'MineToy'
  s.homepage       = 'https://minetoy.fun'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/lcaballerot/MineToyApp.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # El mismo WebRTC que react-native-webrtc: su RTCAudioSession es la que usa el motor de audio.
  s.dependency 'JitsiWebRTC'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
