#!/usr/bin/env node
// Asserts the npm tarball contains exactly what it should before `npm publish`.
// A published version can never be overwritten, so a missing README or a leaked
// secret/source file is unrecoverable without burning a version number. This runs
// `npm pack --dry-run --json` and fails the release if the manifest is wrong.
const { spawnSyncWithAutoShell } = require('./util');

// Files that MUST be in every published tarball.
const REQUIRED = [
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'NOTICE',
  'app.plugin.js',
  'expo-module.config.json',
  'build/index.js',
  'build/index.d.ts',
  'plugin/build/index.js',
  'ios/MyId.podspec',
  'ios/MyIdModule.swift',
  'android/build.gradle',
  'android/src/main/java/uz/softwhere/myid/MyIdModule.kt',
];

// Paths that must NEVER ship. Each RegExp is tested against every packed path
// (paths are package-root-relative, no leading "./"). Note `android/src/` is
// intentionally allowed — the native Kotlin sources are consumed by autolinking —
// so the source rules anchor at the repo root (`^src/`, `^plugin/src/`).
const FORBIDDEN = [
  { re: /(^|\/)\.env($|\.)/, why: 'environment / secrets file' },
  { re: /^example\//, why: 'example app' },
  { re: /(^|\/)__tests__\//, why: 'test files' },
  { re: /\.(test|spec)\.[jt]sx?$/, why: 'test file' },
  { re: /^src\//, why: 'TypeScript source (only build/ should ship)' },
  { re: /^plugin\/src\//, why: 'plugin TypeScript source (only plugin/build/ should ship)' },
  { re: /(^|\/)node_modules\//, why: 'bundled dependencies' },
  { re: /\.tsbuildinfo$/, why: 'incremental build cache' },
];

function packedFiles() {
  // --ignore-scripts: the build already ran earlier in the release job; skipping
  // the `prepare` rebuild keeps stdout clean JSON and avoids redundant work.
  const res = spawnSyncWithAutoShell(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { encoding: 'utf8' }
  );
  if (res.status !== 0) {
    throw new Error(`\`npm pack\` failed (exit ${res.status}):\n${res.stderr || ''}`);
  }
  const out = res.stdout || '';
  const start = out.indexOf('[');
  if (start === -1) {
    throw new Error(`Could not find JSON in \`npm pack\` output:\n${out}`);
  }
  const parsed = JSON.parse(out.slice(start));
  return parsed[0].files.map((f) => f.path);
}

function main() {
  const files = packedFiles();
  const problems = [];

  for (const req of REQUIRED) {
    if (!files.includes(req)) {
      problems.push(`missing required file: ${req}`);
    }
  }
  for (const file of files) {
    for (const rule of FORBIDDEN) {
      if (rule.re.test(file)) {
        problems.push(`forbidden file shipped (${rule.why}): ${file}`);
      }
    }
  }

  if (problems.length > 0) {
    console.error('✗ Tarball verification FAILED:');
    for (const p of problems) {
      console.error(`  - ${p}`);
    }
    console.error(`\nPacked ${files.length} files. Fix package.json "files" and try again.`);
    process.exit(1);
  }

  console.log(
    `✓ Tarball verified: ${files.length} files, ` +
      `all ${REQUIRED.length} required present, no forbidden paths.`
  );
}

main();
