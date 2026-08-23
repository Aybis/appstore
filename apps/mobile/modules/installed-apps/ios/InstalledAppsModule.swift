import ExpoModulesCore

/**
 * iOS has no equivalent, and this returns nothing on purpose.
 *
 * There is no API that reports whether another app is installed, let alone its
 * version. `canOpenURL` only answers whether *some* app claims a URL scheme,
 * requires every scheme to be declared up front in `LSApplicationQueriesSchemes`
 * — impossible against a dynamic catalog — and reports no version at all.
 *
 * So `isSupported` is false here and the caller falls back to MAYA's own
 * install log. Shipping a half-answer that silently disagrees with the device
 * would be worse than admitting the platform cannot do this.
 */
public class InstalledAppsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("InstalledApps")

    Function("isSupported") { false }

    Function("getInstalledVersions") { (_: [String]) -> [String: String?] in
      [:]
    }
  }
}
