import plugin, {
  addFirebasePostInstall,
  addMavenRepository,
  mergePrivacyAccessedApiTypes,
  MYID_PRIVACY_ACCESSED_API_TYPES,
} from '../index';

const MAVEN_URL = 'https://artifactory.myid.uz/artifactory/myid';

const GRADLE = `buildscript {
  repositories {
    google()
    mavenCentral()
  }
}

allprojects {
  repositories {
    google()
    mavenCentral()
  }
}
`;

const PODFILE = `platform :ios, '15.1'
target 'App' do
  use_expo_modules!
  post_install do |installer|
    react_native_post_install(installer)
  end
end
`;

describe('addMavenRepository', () => {
  it('injects the maven repo into the allprojects repositories block', () => {
    const out = addMavenRepository(GRADLE, MAVEN_URL);
    expect(out).toContain(`maven { url "${MAVEN_URL}" }`);
    // Injected under allprojects, not buildscript.
    const allprojectsIdx = out.indexOf('allprojects');
    expect(out.indexOf(MAVEN_URL)).toBeGreaterThan(allprojectsIdx);
  });

  it('is idempotent (second application does not duplicate)', () => {
    const once = addMavenRepository(GRADLE, MAVEN_URL);
    const twice = addMavenRepository(once, MAVEN_URL);
    expect(twice).toBe(once);
    expect(
      twice.match(new RegExp(MAVEN_URL.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'g'))
    ).toHaveLength(1);
  });

  it('is a no-op when there is no allprojects block', () => {
    const gradle = `buildscript {\n  repositories {\n    google()\n  }\n}\n`;
    expect(addMavenRepository(gradle, MAVEN_URL)).toBe(gradle);
  });
});

describe('mergePrivacyAccessedApiTypes', () => {
  it('adds all four MyID required-reason API types to an empty list', () => {
    const merged = mergePrivacyAccessedApiTypes([]);
    expect(merged).toHaveLength(4);
    const categories = merged.map((e) => e.NSPrivacyAccessedAPIType).sort();
    expect(categories).toEqual(
      [...MYID_PRIVACY_ACCESSED_API_TYPES].map((e) => e.NSPrivacyAccessedAPIType).sort()
    );
    const fileTs = merged.find(
      (e) => e.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryFileTimestamp'
    );
    expect(fileTs?.NSPrivacyAccessedAPITypeReasons).toContain('0A2A.1');
  });

  it('preserves unrelated existing entries and unions reason codes', () => {
    const existing = [
      {
        NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
        NSPrivacyAccessedAPITypeReasons: ['C617.1'],
      },
      {
        NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryActiveKeyboards',
        NSPrivacyAccessedAPITypeReasons: ['54BD.1'],
      },
    ];
    const merged = mergePrivacyAccessedApiTypes(existing);
    const fileTs = merged.find(
      (e) => e.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryFileTimestamp'
    );
    expect(fileTs?.NSPrivacyAccessedAPITypeReasons.sort()).toEqual(['0A2A.1', 'C617.1']);
    expect(
      merged.some(
        (e) => e.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryActiveKeyboards'
      )
    ).toBe(true);
  });

  it('is idempotent', () => {
    const once = mergePrivacyAccessedApiTypes([]);
    const twice = mergePrivacyAccessedApiTypes(once);
    expect(twice).toHaveLength(once.length);
    for (const entry of twice) {
      expect(entry.NSPrivacyAccessedAPITypeReasons).toEqual([
        ...new Set(entry.NSPrivacyAccessedAPITypeReasons),
      ]);
    }
  });
});

describe('addFirebasePostInstall', () => {
  it('injects the CLANG flag inside the existing post_install block', () => {
    const out = addFirebasePostInstall(PODFILE);
    expect(out).toContain('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES');
    expect(out.indexOf('CLANG_ALLOW')).toBeGreaterThan(out.indexOf('post_install do |installer|'));
  });

  it('is idempotent', () => {
    const once = addFirebasePostInstall(PODFILE);
    const twice = addFirebasePostInstall(once);
    expect(twice).toBe(once);
  });

  it('is a no-op when there is no post_install block', () => {
    const podfile = `platform :ios, '15.1'\ntarget 'App' do\n  use_expo_modules!\nend\n`;
    expect(addFirebasePostInstall(podfile)).toBe(podfile);
  });
});

describe('withMyId plugin', () => {
  it('merges the MyID privacy manifest into the Expo config', () => {
    const config = { name: 'test', slug: 'test' } as never;
    const result = plugin(config, {}) as {
      ios?: { privacyManifests?: { NSPrivacyAccessedAPITypes?: unknown[] } };
    };
    expect(result.ios?.privacyManifests?.NSPrivacyAccessedAPITypes).toHaveLength(4);
  });
});
