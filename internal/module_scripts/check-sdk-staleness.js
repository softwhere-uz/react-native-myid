#!/usr/bin/env node
// Compares the MyID SDK versions this package pins against the newest STABLE
// versions published upstream, and reports when a bump is available. Pins are
// read from the repo (never hard-coded here, so this can't itself go stale).
//
// Pre-releases are deliberately ignored: the Android Artifactory advertises
// `<latest>`/`<release>` as a beta (e.g. 3.1.10-beta02) while the newest stable
// is 3.1.9, and this package's policy is to pin exact stables only.
const fs = require('fs');
const path = require('path');

const IOS_TRUNK = 'https://trunk.cocoapods.org/api/v1/pods/MyIdSDK';
const ANDROID_METADATA =
  'https://artifactory.myid.uz/artifactory/myid/uz/myid/sdk/capture/myid-capture-sdk/maven-metadata.xml';

const isStable = (v) => !v.includes('-');

/** Numeric, dot-segment version compare (handles 2.4.91 > 2.4.9). */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function latestStable(versions) {
  const stable = versions.filter(isStable).sort(compareVersions);
  if (stable.length === 0) throw new Error('no stable versions found');
  return stable[stable.length - 1];
}

function readPin(file, regex) {
  const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  const match = text.match(regex);
  if (!match) throw new Error(`could not read a pinned version from ${file}`);
  return match[1];
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function iosLatestStable() {
  const data = JSON.parse(await fetchText(IOS_TRUNK));
  return latestStable(data.versions.map((v) => v.name));
}

async function androidLatestStable() {
  const xml = await fetchText(ANDROID_METADATA);
  const versions = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
  return latestStable(versions);
}

function emit(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

async function main() {
  const iosPin = readPin('ios/MyId.podspec', /MyIdSDK['"]?\s*,\s*['"]([0-9][^'"]*)['"]/);
  const androidPin = readPin('android/build.gradle', /myid-capture-sdk:([0-9][^"']*)/);

  const [iosLatest, androidLatest] = await Promise.all([
    iosLatestStable(),
    androidLatestStable(),
  ]);

  const rows = [
    { platform: 'iOS · MyIdSDK', file: 'ios/MyId.podspec', pinned: iosPin, latest: iosLatest },
    {
      platform: 'Android · myid-capture-sdk',
      file: 'android/build.gradle',
      pinned: androidPin,
      latest: androidLatest,
    },
  ];

  let stale = false;
  const lines = [];
  for (const r of rows) {
    const behind = compareVersions(r.latest, r.pinned) > 0;
    if (behind) stale = true;
    lines.push(
      `${behind ? '⚠️' : '✅'} **${r.platform}** — pinned \`${r.pinned}\`, latest stable \`${r.latest}\`` +
        (behind ? ` → **update available** (\`${r.file}\`)` : '')
    );
  }

  const report = lines.join('\n');
  console.log(report.replace(/\*\*/g, '').replace(/`/g, ''));

  // Always surface the status in the Actions run summary.
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### MyID SDK staleness\n\n${report}\n`
    );
  }

  emit('stale', stale);

  if (stale) {
    const body =
      `A newer **stable** MyID SDK is available upstream:\n\n${report}\n\n` +
      `To adopt it: bump the exact pin in the file(s) above, run the CI native gates, ` +
      `and cut a release. Betas are intentionally ignored per the no-\`+\`/no-beta pin policy.\n\n` +
      `_Filed automatically by \`.github/workflows/sdk-staleness.yml\`._`;
    fs.writeFileSync(path.join(process.cwd(), 'sdk-staleness-report.md'), body);
  }
}

main().catch((error) => {
  console.error('SDK staleness check failed:', error.message);
  process.exit(1);
});
