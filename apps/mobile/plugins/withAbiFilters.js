const { withGradleProperties } = require('expo/config-plugins')

/**
 * Ships only the CPU architectures anything here actually runs on.
 *
 * A universal APK carries native libraries for every architecture at once. On
 * this app that is 83.7 MB of 135 MB uncompressed — and 46.6 MB of it is x86
 * and x86_64, which NO shipping phone uses. They exist for emulators. Every
 * employee on a real device downloads them, stores them, and can never execute
 * a byte of them.
 *
 * That matters most on exactly the hardware this app is meant to serve: an
 * older phone on company wifi, where the difference between a 107 MB download
 * and a 60 MB one is felt.
 *
 * Dropping x86 costs nothing even in development: the build machines are Apple
 * Silicon and the Android images installed on them are arm64-v8a, so the
 * emulator runs the same architecture a phone does. Anyone who does need an
 * x86 emulator can override for one build without touching this file:
 *
 *     ./gradlew assembleDebug -PreactNativeArchitectures=x86_64
 *
 * `reactNativeArchitectures` RATHER THAN `ndk.abiFilters` or `splits.abi`,
 * deliberately, and the distinction cost a build to learn. abiFilters in the
 * release buildType is silently ineffective here — these .so files arrive
 * prebuilt inside AARs rather than being compiled by this project, so there is
 * no NDK build for the filter to constrain, and all four architectures ship
 * anyway. splits.abi does work, but emits one APK per architecture and no
 * combined one, and both EAS and the portal expect a single artifact. The
 * React Native gradle plugin reads this property to decide what to unpack in
 * the first place, which is the only one of the three that removes the bytes
 * rather than trying to filter them afterwards.
 */
const REAL_DEVICE_ABIS = 'armeabi-v7a,arm64-v8a'

const withAbiFilters = (config) =>
  withGradleProperties(config, (mod) => {
    const existing = mod.modResults.find(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures',
    )

    if (existing) {
      existing.value = REAL_DEVICE_ABIS
    } else {
      mod.modResults.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: REAL_DEVICE_ABIS,
      })
    }

    return mod
  })

module.exports = withAbiFilters
