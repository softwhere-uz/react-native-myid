// Reexport the native module. On web, it will be resolved to MyIdModule.web.ts
// and on native platforms to MyIdModule.ts
export { default } from './MyIdModule';
export * from './MyId.types';
