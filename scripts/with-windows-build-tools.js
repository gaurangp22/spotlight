const { existsSync } = require('node:fs');
const { withAppBuildGradle } = require('expo/config-plugins');

// Older Android SDKs bundle Ninja versions that reject long C++ object paths.
// A local Windows build may opt into Ninja 1.12+ without changing the SDK.
module.exports = function withWindowsBuildTools(config) {
  const ninjaPath = process.env.MARGIN_NINJA_PATH;
  if (process.platform !== 'win32' || !ninjaPath) return config;
  if (!existsSync(ninjaPath)) throw new Error('MARGIN_NINJA_PATH must point to an installed Ninja executable.');
  return withAppBuildGradle(config, (mod) => {
    const marker = '// MARGIN: use a local Ninja with Windows long-path support';
    if (mod.modResults.contents.includes(marker)) return mod;
    const anchor = '    defaultConfig {';
    if (mod.modResults.language !== 'groovy' || !mod.modResults.contents.includes(anchor)) {
      throw new Error('Cannot configure local Ninja in the generated Android build.');
    }
    const argument = `-DCMAKE_MAKE_PROGRAM=${ninjaPath.replace(/\\/g, '/')}`.replace(/'/g, "\\'");
    mod.modResults.contents = mod.modResults.contents.replace(anchor, `${anchor}
        ${marker}
        externalNativeBuild {
            cmake {
                arguments '${argument}'
            }
        }`);
    return mod;
  });
};
