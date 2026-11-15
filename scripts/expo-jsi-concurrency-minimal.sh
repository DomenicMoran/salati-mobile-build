#!/usr/bin/env bash
# Nach `pod install`: SWIFT_STRICT_CONCURRENCY=minimal nur für ExpoModulesJSI*.
# Braucht runIsolated (jsi ≥57.0.6) und Xcode 26 zugleich.
set -euo pipefail
cd "${1:-ios}"
test -f Pods/Pods.xcodeproj/project.pbxproj || { echo "kein Pods-Projekt"; exit 1; }

ruby <<'RUBY'
require 'xcodeproj'
path = 'Pods/Pods.xcodeproj'
project = Xcodeproj::Project.open(path)
n = 0
project.targets.each do |target|
  next unless target.name.include?('ExpoModulesJSI')
  target.build_configurations.each do |config|
    config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
    n += 1
  end
  puts "patched #{target.name}"
end
project.save
puts "SWIFT_STRICT_CONCURRENCY=minimal in #{n} configs"
RUBY
