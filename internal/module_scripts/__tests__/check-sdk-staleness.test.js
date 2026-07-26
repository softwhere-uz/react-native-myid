// Unit tests for the pure version-comparison helpers behind the weekly SDK
// staleness check. A bug in compareVersions/latestStable would either miss a
// real upstream bump or (worse) flag a beta as an update, so the numeric
// ordering and pre-release filtering are locked down here. `readPin` is also
// tested against the REAL pinned files, doubling as a regression guard that the
// podspec/gradle pin formats still match the extraction regexes.
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  compareVersions,
  latestStable,
  isStable,
  readPin,
  parseIosVersions,
  parseAndroidVersions,
  buildStalenessReport,
  emit,
} = require('../check-sdk-staleness');

describe('compareVersions', () => {
  it('orders by numeric dot segments (not lexicographically)', () => {
    expect(compareVersions('2.4.91', '2.4.9')).toBeGreaterThan(0);
    expect(compareVersions('3.1.10', '3.1.9')).toBeGreaterThan(0);
    expect(compareVersions('3.0.0', '3.1.0')).toBeLessThan(0);
  });

  it('returns 0 for equal versions', () => {
    expect(compareVersions('3.1.3', '3.1.3')).toBe(0);
  });

  it('treats missing trailing segments as zero', () => {
    expect(compareVersions('3.1', '3.1.0')).toBe(0);
    expect(compareVersions('3.1.1', '3.1')).toBeGreaterThan(0);
    expect(compareVersions('3.1', '3.1.1')).toBeLessThan(0);
  });
});

describe('isStable', () => {
  it('accepts plain semver and rejects any pre-release', () => {
    expect(isStable('3.1.9')).toBe(true);
    expect(isStable('3.1.3')).toBe(true);
    expect(isStable('3.1.10-beta02')).toBe(false);
    expect(isStable('3.1.10-rc.1')).toBe(false);
  });
});

describe('latestStable', () => {
  it('returns the newest stable, ignoring pre-releases', () => {
    expect(latestStable(['3.1.2', '3.1.9', '3.1.10-beta02', '3.1.3'])).toBe('3.1.9');
  });

  it('ignores ordering of the input', () => {
    expect(latestStable(['3.1.10-beta02', '3.1.3', '3.1.9'])).toBe('3.1.9');
  });

  it('throws when there are no stable versions', () => {
    expect(() => latestStable(['1.0.0-beta', '2.0.0-rc.1'])).toThrow(/no stable/);
  });
});

describe('readPin', () => {
  it('extracts the iOS MyIdSDK pin from the real podspec', () => {
    const pin = readPin('ios/MyId.podspec', /MyIdSDK['"]?\s*,\s*['"]([0-9][^'"]*)['"]/);
    expect(pin).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('extracts the Android myid-capture-sdk pin from the real build.gradle', () => {
    const pin = readPin('android/build.gradle', /myid-capture-sdk:([0-9][^"']*)/);
    expect(pin).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('throws a helpful error when the pin cannot be found', () => {
    expect(() => readPin('package.json', /THIS_PATTERN_WONT_MATCH_([0-9]+)/)).toThrow(
      /could not read a pinned version/
    );
  });
});

describe('parseIosVersions', () => {
  it('extracts version names from the CocoaPods trunk JSON shape', () => {
    const json = JSON.stringify({
      versions: [{ name: '3.1.2' }, { name: '3.1.3' }],
    });
    expect(parseIosVersions(json)).toEqual(['3.1.2', '3.1.3']);
  });

  it('composes with latestStable to pick the newest stable', () => {
    const json = JSON.stringify({
      versions: [{ name: '3.1.2' }, { name: '3.1.3' }, { name: '3.1.4-beta1' }],
    });
    expect(latestStable(parseIosVersions(json))).toBe('3.1.3');
  });
});

describe('parseAndroidVersions', () => {
  it('extracts every <version> from the maven-metadata XML', () => {
    const xml = `<metadata><versioning><versions>
      <version>3.1.8</version>
      <version>3.1.9</version>
      <version>3.1.10-beta02</version>
    </versions></versioning></metadata>`;
    expect(parseAndroidVersions(xml)).toEqual(['3.1.8', '3.1.9', '3.1.10-beta02']);
  });

  it('composes with latestStable to ignore the beta metadata tag', () => {
    const xml = `<version>3.1.9</version><version>3.1.10-beta02</version>`;
    expect(latestStable(parseAndroidVersions(xml))).toBe('3.1.9');
  });
});

describe('buildStalenessReport', () => {
  const upToDateRows = [
    { platform: 'iOS · MyIdSDK', file: 'ios/MyId.podspec', pinned: '3.1.3', latest: '3.1.3' },
    { platform: 'Android', file: 'android/build.gradle', pinned: '3.1.9', latest: '3.1.9' },
  ];

  it('reports not stale when every pin equals the latest stable', () => {
    const { stale, report } = buildStalenessReport(upToDateRows);
    expect(stale).toBe(false);
    expect(report).toContain('✅');
    expect(report).not.toContain('update available');
  });

  it('flags stale when any pin is behind the latest stable', () => {
    const rows = [
      { platform: 'iOS · MyIdSDK', file: 'ios/MyId.podspec', pinned: '3.1.3', latest: '3.1.3' },
      { platform: 'Android', file: 'android/build.gradle', pinned: '3.1.9', latest: '3.1.10' },
    ];
    const { stale, report } = buildStalenessReport(rows);
    expect(stale).toBe(true);
    expect(report).toContain('⚠️');
    expect(report).toContain('update available');
    expect(report).toContain('android/build.gradle');
  });
});

describe('emit', () => {
  const original = process.env.GITHUB_OUTPUT;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.GITHUB_OUTPUT;
    } else {
      process.env.GITHUB_OUTPUT = original;
    }
  });

  it('appends "name=value" to the GITHUB_OUTPUT file when set', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'myid-emit-')), 'out.txt');
    process.env.GITHUB_OUTPUT = file;
    emit('stale', true);
    expect(fs.readFileSync(file, 'utf8')).toBe('stale=true\n');
  });

  it('is a no-op when GITHUB_OUTPUT is not set', () => {
    delete process.env.GITHUB_OUTPUT;
    expect(() => emit('stale', false)).not.toThrow();
  });
});
