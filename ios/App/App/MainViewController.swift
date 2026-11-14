import Capacitor

@objc(MainViewController)
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(WifiSignalPlugin())
        bridge?.registerPluginInstance(SkyOrientationPlugin())
        // Rig notifications in the background (Local Push Connectivity, #1492)
        bridge?.registerPluginInstance(SessionMonitorPlugin())
    }
}
