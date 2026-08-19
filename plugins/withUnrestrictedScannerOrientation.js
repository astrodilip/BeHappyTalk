const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

// expo-camera pulls in Google's ML Kit barcode scanner, whose delegate activity
// declares android:screenOrientation="portrait". Play reports that as a large-screen
// resizability restriction even though this app never launches the scanner, so the
// attribute is overridden during manifest merging.
const SCANNER_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

module.exports = function withUnrestrictedScannerOrientation(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    // tools:replace needs the tools namespace declared on <manifest>.
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.activity = application.activity || [];

    const attributes = {
      'android:name': SCANNER_ACTIVITY,
      'android:screenOrientation': 'unspecified',
      'tools:replace': 'android:screenOrientation',
    };

    const existing = application.activity.find(
      (activity) => activity.$?.['android:name'] === SCANNER_ACTIVITY
    );
    if (existing) {
      Object.assign(existing.$, attributes);
    } else {
      application.activity.push({ $: attributes });
    }

    return cfg;
  });
};
