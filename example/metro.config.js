// Learn more https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const config = getDefaultConfig(projectRoot);

// Resolve a package's directory from the example's own node_modules.
const fromProject = (name) =>
  path.dirname(require.resolve(`${name}/package.json`, { paths: [projectRoot] }));

// Watch the library so Metro can read its built output (../build).
config.watchFolders = [workspaceRoot];

config.resolver.extraNodeModules = {
  // Resolve the package by its published name to the library root
  // (package.json `main` -> ../build/index.js).
  '@softwhere-uz/react-native-myid': workspaceRoot,
  // The library keeps no react-native/expo in its node_modules (it dev-depends
  // on expo-modules-core only), so its built code must resolve these shared deps
  // to the EXAMPLE's copies — otherwise there would be two React Natives.
  'expo-modules-core': fromProject('expo-modules-core'),
  react: fromProject('react'),
  'react-native': fromProject('react-native'),
};

module.exports = config;
