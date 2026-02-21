import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {

        // 1️⃣ Kill ALL rubber-band bounce globally
        UIScrollView.appearance().bounces = false
        UIScrollView.appearance().alwaysBounceVertical = false
        UIScrollView.appearance().alwaysBounceHorizontal = false

        // 2️⃣ Ensure WebView background never shows transparency
        if let bridgeVC = window?.rootViewController as? CAPBridgeViewController,
           let webView = bridgeVC.webView {

            webView.isOpaque = true
            webView.backgroundColor = UIColor.systemBackground
            webView.scrollView.backgroundColor = UIColor.systemBackground

            if #available(iOS 11.0, *) {
                webView.scrollView.contentInsetAdjustmentBehavior = .never
            }
        }

        return true
    }

    func application(_ app: UIApplication,
                     open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication,
                     continue userActivity: NSUserActivity,
                     restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
