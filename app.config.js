// HTTP is permitted only for an explicitly requested local test APK.
// Production builds keep Android's HTTPS-only transport policy.
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []).filter((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-build-properties'),
    ['expo-build-properties', { android: { usesCleartextTraffic: process.env.MARGIN_LOCAL_PREVIEW === '1' } }],
    './scripts/with-windows-build-tools',
  ],
});
