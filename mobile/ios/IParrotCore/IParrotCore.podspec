# Empacota o Iparrotcore.xcframework gerado pelo gomobile para o CocoaPods.
Pod::Spec.new do |s|
  s.name                = 'IParrotCore'
  s.version             = '0.1.0'
  s.summary             = 'Núcleo P2P do IParrot (Go: weshnet + Berty Messenger), compilado com gomobile.'
  s.homepage            = 'https://github.com/berty/weshnet'
  s.license             = { :type => 'Apache-2.0 OR MIT' }
  s.author              = 'IParrot'
  s.source              = { :path => '.' }
  s.platform            = :ios, '14.0'
  s.vendored_frameworks = 'Iparrotcore.xcframework'
  s.static_framework    = true
  s.libraries           = 'resolv'
end
