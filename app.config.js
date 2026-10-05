// HTTP is permitted only for an explicitly requested local test APK.
// Production builds keep Android's HTTPS-only transport policy.
// Release builds ship only real-phone CPU architectures (about half the APK size);
// development builds keep x86 so they still run on emulators.
const releaseProfile = ['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE) || process.env.MARGIN_PHONE_ONLY === '1';

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []).filter((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-build-properties'),
    ['expo-build-properties', {
      android: {
        usesCleartextTraffic: process.env.MARGIN_LOCAL_PREVIEW === '1',
        ...(releaseProfile ? { buildArchs: ['arm64-v8a', 'armeabi-v7a'] } : {}),
      },
    }],
    './scripts/with-windows-build-tools',
  ],
});
