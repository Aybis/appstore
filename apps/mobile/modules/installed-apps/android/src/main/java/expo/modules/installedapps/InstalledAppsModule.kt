package expo.modules.installedapps

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import java.io.File
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

    /**
     * Launches an installed app by package name. Returns false if it could not.
     *
     * This exists because the catalog could TELL that an app was installed and
     * then had no way to act on it. A row for an app already on the device
     * showed "Open", and pressing it fell through to the install path — so a
     * user with Telegram installed was asked to install Telegram. Detection
     * without launching is a button that lies.
     *
     * `getLaunchIntentForPackage` returns null for a package that is installed
     * but has no launcher activity — a service, a plugin, a provider. That is a
     * real state, not an error, so it is reported as false and the caller keeps
     * the app's own detail screen rather than throwing at somebody who pressed
     * a button.
     *
     * NEW_TASK is required because the intent is started from a non-Activity
     * context; without it Android refuses to launch at all.
     */
    Function("launchApp") { packageName: String ->
      val context = appContext.reactContext ?: return@Function false
      val intent: Intent = context.packageManager.getLaunchIntentForPackage(packageName)
        ?: return@Function false

      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        true
      } catch (error: Exception) {
        false
      }
    }

    /**
     * Whether Android will let MAYA hand a package to the system installer.
     *
     * Android 8+ gates "install unknown apps" per source app. Without the grant
     * the installer intent is refused, and on some OEM builds (Samsung) the
     * refusal reads like a broken file. Asking first lets the store say what is
     * actually wrong.
     */
    Function("canRequestPackageInstalls") {
      val context = appContext.reactContext ?: return@Function true
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function true
      context.packageManager.canRequestPackageInstalls()
    }

    /**
     * Parses a downloaded APK the way the system installer will, and returns
     * its identity, or null when Android cannot parse it.
     *
     * Null here is exactly the condition the installer reports as "There was a
     * problem parsing the package" / "Can't install app". Catching it before
     * the hand-off means a truncated or wrong file is deleted and re-fetched,
     * instead of being offered to the installer again on every retry.
     */
    AsyncFunction("inspectApk") { uri: String ->
      val manager = appContext.reactContext?.packageManager ?: return@AsyncFunction null
      val path = toFile(uri).absolutePath
      @Suppress("DEPRECATION")
      val info = manager.getPackageArchiveInfo(path, 0) ?: return@AsyncFunction null
      val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        info.longVersionCode
      } else {
        @Suppress("DEPRECATION")
        info.versionCode.toLong()
      }
      mapOf(
        "packageName" to info.packageName,
        "versionName" to info.versionName,
        "versionCode" to versionCode.toDouble(),
      )
    }
  }

  /** Accepts a file:// URI or a bare path, as handed over from expo-file-system. */
  private fun toFile(uri: String): File =
    if (uri.startsWith("file://")) File(Uri.parse(uri).path!!) else File(uri)
}
