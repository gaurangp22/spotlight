Pod::Spec.new do |s|
  s.name           = 'VideoOverlay'
  s.version        = '1.0.0'
  s.summary        = 'Burns a transparent PNG overlay onto a recorded video.'
  s.description    = 'Composites a full-frame PNG over an mp4 with AVFoundation for Riffs video reviews.'
  s.license        = 'UNLICENSED'
  s.author         = 'Riffs'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
