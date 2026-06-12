// Metro config for the OctoVault monorepo.
//
// The @drakkar.software/starfish-* packages and the workspace-local
// @drakkar.software/octovault-sdk are resolved from raw TypeScript source so
// no build step is needed during development. Package `exports` is enabled for
// subpath conditions (react-native, import, types).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so Metro HMR picks up changes in packages/sdk.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.unstable_enablePackageExports = true;

// Never bundle the Node-only server package or its server deps into the app.
config.resolver.blockList = [/\/apps\/server\//, /\/@hono\/node-server\//];

// Custom resolver:
//   1. @drakkar.software/octovault-sdk  → packages/sdk/src/index.ts (raw TS, no dist needed)
//   2. @drakkar.software/octovault-sdk/platform → native or web platform adapter
//   3. @drakkar.software/octovault-sdk/hash-wasm-shim → pure-JS Argon2 shim
//   4. hash-wasm → same shim (used by starfish-identities, no WebAssembly needed)
const SDK_SRC = path.resolve(workspaceRoot, 'packages/sdk/src');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@drakkar.software/octovault-sdk') {
    return { type: 'sourceFile', filePath: path.join(SDK_SRC, 'index.ts') };
  }
  if (moduleName === '@drakkar.software/octovault-sdk/platform') {
    // Hard-branch: Metro's auto .native extension resolution only fires for the
    // default (non-`filePath`) resolution path. A hard filePath return bypasses it,
    // so we must branch manually.
    const isNative = platform === 'ios' || platform === 'android';
    return {
      type: 'sourceFile',
      filePath: path.join(SDK_SRC, 'platform', isNative ? 'index.native.ts' : 'index.ts'),
    };
  }
  if (
    moduleName === '@drakkar.software/octovault-sdk/hash-wasm-shim' ||
    moduleName === 'hash-wasm'
  ) {
    return { type: 'sourceFile', filePath: path.join(SDK_SRC, 'platform', 'hash-wasm-shim.ts') };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
