// Babel config used only by Jest (babel-jest) to transform the pure-TS unit
// tests. The library itself is built with tsc (expo-module-scripts), and the
// example app has its own babel config — neither uses this file.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
};
