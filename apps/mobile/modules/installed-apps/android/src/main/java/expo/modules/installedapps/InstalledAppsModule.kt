package expo.modules.installedapps

import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Asks Android which of a set of packages are installed, and at what version.
 *
 * Requires `QUERY_ALL_PACKAGES`. That permission is restricted by GOOGLE PLAY
 * POLICY, not by Android: on Android 11+ a package not covered by `<queries>`
 * or that permission is reported as absent even when it is installed. MAYA is
 * an internal store distributed outside Play, so the policy does not bind it —
 * and `<queries>` cannot work here anyway, because the catalog is dynamic and
 * that element is static in the manifest.
 *
 * Reads are batched into one call. Crossing the bridge once per app would make
 * a catalog of forty a forty-round-trip operation on the exact low-end hardware
 * this app has to stay smooth on.
 */
class InstalledAppsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("InstalledApps")

    Function("isSupported") { true }

    /**
     * Maps each requested package name to its installed versionName, or null.
     *
     * Null means "not installed, or not visible to us" — Android does not
     * distinguish the two, and callers must not read absence as proof of
     * absence for anything security-relevant.
     */
    Function("getInstalledVersions") { packageNames: List<String> ->
      val manager = appContext.reactContext?.packageManager
        ?: return@Function emptyMap<String, String?>()

      packageNames.associateWith { name ->
        try {
          @Suppress("DEPRECATION")
          manager.getPackageInfo(name, 0).versionName
        } catch (error: PackageManager.NameNotFoundException) {
          null
        }
      }
    }
  }
}
