const { withAndroidManifest } = require('expo/config-plugins');

// The app is locked to portrait, which makes Play treat a portrait screen as required hardware.
// Marking it optional keeps the lock but lets devices without a portrait screen install the app.
module.exports = (config) =>
  withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    const features = (manifest['uses-feature'] ??= []);
    if (!features.some((f) => f.$['android:name'] === 'android.hardware.screen.portrait')) {
      features.push({ $: { 'android:name': 'android.hardware.screen.portrait', 'android:required': 'false' } });
    }
    return c;
  });
