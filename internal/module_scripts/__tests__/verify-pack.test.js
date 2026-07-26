// Unit tests for the pre-publish tarball verifier. `checkTarball` is the pure
// core of internal/module_scripts/verify-pack.js — it decides, from the list of
// packed paths, whether a release is safe to publish. A regression here could
// ship source/secrets or omit the README, and a published version can never be
// overwritten, so this logic is worth locking down.
const { checkTarball, REQUIRED, FORBIDDEN } = require('../verify-pack');

describe('checkTarball', () => {
  it('reports no problems for a tarball with every required file and nothing forbidden', () => {
    expect(checkTarball([...REQUIRED])).toEqual([]);
  });

  it('flags each missing required file', () => {
    const withoutReadme = REQUIRED.filter((f) => f !== 'README.md');
    const problems = checkTarball(withoutReadme);
    expect(problems).toContain('missing required file: README.md');
  });

  it('reports every missing required file, not just the first', () => {
    const problems = checkTarball([]);
    expect(problems).toHaveLength(REQUIRED.length);
    for (const req of REQUIRED) {
      expect(problems).toContain(`missing required file: ${req}`);
    }
  });

  it.each([
    ['.env', /environment \/ secrets file/],
    ['config/.env.production', /environment \/ secrets file/],
    ['example/App.tsx', /example app/],
    ['build/__tests__/foo.js', /test files/],
    ['build/index.test.js', /test file/],
    ['src/index.ts', /TypeScript source/],
    ['plugin/src/index.ts', /plugin TypeScript source/],
    ['node_modules/lodash/index.js', /bundled dependencies/],
    ['plugin/tsconfig.tsbuildinfo', /incremental build cache/],
  ])('flags forbidden path %s', (path, reasonPattern) => {
    const problems = checkTarball([...REQUIRED, path]);
    expect(problems.some((p) => reasonPattern.test(p))).toBe(true);
  });

  it('allows the native android/src Kotlin sources (consumed by autolinking)', () => {
    // android/src/... is intentionally NOT matched by the ^src/ forbidden rule.
    const problems = checkTarball([...REQUIRED]);
    expect(problems).toEqual([]);
    expect(
      REQUIRED.includes('android/src/main/java/uz/softwhere/myid/MyIdModule.kt')
    ).toBe(true);
  });
});

describe('FORBIDDEN rules', () => {
  it('does not treat android/src paths as forbidden source', () => {
    const androidSrc = 'android/src/main/java/uz/softwhere/myid/MyIdModule.kt';
    const matched = FORBIDDEN.filter((rule) => rule.re.test(androidSrc));
    expect(matched).toEqual([]);
  });

  it('anchors the src rule at the repo root (does not match build/src style paths accidentally)', () => {
    const srcRule = FORBIDDEN.find((r) => r.why.includes('TypeScript source'));
    expect(srcRule.re.test('src/index.ts')).toBe(true);
    expect(srcRule.re.test('android/src/main/Foo.kt')).toBe(false);
  });
});
