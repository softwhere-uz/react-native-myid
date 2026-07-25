Pod::Spec.new do |s|
  s.name           = 'MyId'
  s.version        = '0.1.5'
  s.summary        = 'MyID biometric eKYC (face liveness) for React Native & Expo.'
  s.description    = 'iOS bridge for the MyID SDK, exposed to React Native via the Expo Modules API.'
  s.author         = { 'Kamronbek Juraev' => 'kamuranbek1998@gmail.com' }
  s.homepage       = 'https://github.com/softwhere-uz/react-native-myid'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: 'https://github.com/softwhere-uz/react-native-myid.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # MyID SDK — referenced from the public CocoaPods trunk, NEVER vendored/bundled
  # by this package. The consuming app resolves it at `pod install`. Requires
  # `use_frameworks! :linkage => :static` (the config plugin sets this).
  # Pinned to an EXACT version (not `~> 3.1.3`) so an untested MyIdSDK patch can't
  # silently resolve into a build — mirroring the exact Android pin. MyID versions
  # its iOS and Android SDKs independently (iOS tops out at 3.1.3; Android at 3.1.9).
  s.dependency 'MyIdSDK', '3.1.3'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
