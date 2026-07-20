#!/usr/bin/env node
// Asserts that `expo prebuild` on the example applied every mod our config
// plugin is responsible for. Run after `expo prebuild` in the example dir.
// Exits non-zero (failing CI) if any expected mod is missing.
import fs from 'node:fs';
import path from 'node:path';

const exampleDir = path.resolve(process.argv[2] ?? 'example');
const checks = [];
const assert = (name, ok) => checks.push({ name, ok: Boolean(ok) });
const read = (rel) => {
  try {
    return fs.readFileSync(path.join(exampleDir, rel), 'utf8');
  } catch {
    return '';
  }
};

// --- iOS ---
const podProps = read('ios/Podfile.properties.json');
assert('iOS · static frameworks (ios.useFrameworks=static)', /"ios\.useFrameworks"\s*:\s*"static"/.test(podProps));

const iosDir = path.join(exampleDir, 'ios');
const iosProject = fs.existsSync(iosDir)
  ? fs.readdirSync(iosDir).find((d) => fs.existsSync(path.join(iosDir, d, 'Info.plist'))) ?? ''
  : '';

const infoPlist = iosProject ? read(`ios/${iosProject}/Info.plist`) : '';
assert('iOS · NSCameraUsageDescription in Info.plist', infoPlist.includes('NSCameraUsageDescription'));

const privacy = iosProject ? read(`ios/${iosProject}/PrivacyInfo.xcprivacy`) : '';
for (const code of ['0A2A.1', '35F9.1', '85F4.1', 'CA92.1']) {
  assert(`iOS · privacy required-reason code ${code}`, privacy.includes(code));
}

// --- Android ---
const rootGradle = read('android/build.gradle');
assert('Android · MyID Maven repository in allprojects', rootGradle.includes('artifactory.myid.uz/artifactory/myid'));

const manifest = read('android/app/src/main/AndroidManifest.xml');
assert('Android · CAMERA permission', /android\.permission\.CAMERA/.test(manifest));

// --- Report ---
let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? '✅' : '❌'} ${c.name}`);
  if (!c.ok) failed += 1;
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} prebuild assertions FAILED.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} prebuild assertions passed.`);
