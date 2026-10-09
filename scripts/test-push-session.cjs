const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const output = ts.transpileModule(fs.readFileSync('src/lib/push.native.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
async function scenario(switchAt) {
  let epoch = 1;
  const writes = [];
  const shim = { exports: {} };
  const modules = {
    'expo-constants': { __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'fixture-project' } } } } },
    'expo-device': { isDevice: true },
    'expo-notifications': {
      setNotificationHandler() {},
      getPermissionsAsync: async () => ({ status: 'granted' }),
      getExpoPushTokenAsync: async () => { if (switchAt === 'token') epoch++; return { data: 'ExponentPushToken[fixture]' }; },
    },
    'expo-router': { router: {} },
    react: { useEffect() {} },
    'react-native': { Platform: { OS: 'ios' } },
    './api': { apiSessionEpoch: () => epoch, api: async (path) => { writes.push(path); if (switchAt === 'registration' && path === '/push/token') epoch++; } },
    '../store/AppContext': {},
  };
  new Function('require', 'module', 'exports', output)((name) => { assert.ok(modules[name], name); return modules[name]; }, shim, shim.exports);
  if (switchAt) await assert.rejects(shim.exports.registerPush(), /account changed/);
  else await shim.exports.registerPush();
  return writes;
}
(async () => {
  assert.deepEqual(await scenario('token'), []);
  assert.deepEqual(await scenario('registration'), ['/push/token']);
  assert.deepEqual(await scenario(null), ['/push/token', '/me/preferences']);
  console.log('Push session checks passed: account changes cancel registration and preference writes.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
