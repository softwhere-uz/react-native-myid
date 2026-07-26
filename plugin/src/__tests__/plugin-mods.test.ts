// Drives the config-plugin *mod callbacks* (the withSettingsGradle /
// withProjectBuildGradle / withInfoPlist / withPodfile[Properties] bodies),
// which the pure-helper tests in plugin.test.ts do not execute. We mock
// `@expo/config-plugins` so each `with*` call records its callback on the
// config object instead of queueing it; the test then invokes the callback
// with a synthetic `mod` and asserts on the mutation.
import { WarningAggregator } from '@expo/config-plugins';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import withMyId from '../index';

// jest.mock is hoisted above the imports above by babel-plugin-jest-hoist, so
// the mock is in place before '../index' (which imports @expo/config-plugins)
// loads — despite being written here.
jest.mock('@expo/config-plugins', () => {
  const record = (key: string) => (config: Record<string, unknown>, action: unknown) => {
    config[key] = action;
    return config;
  };
  return {
    withSettingsGradle: jest.fn(record('__settingsGradle')),
    withProjectBuildGradle: jest.fn(record('__projectBuildGradle')),
    withInfoPlist: jest.fn(record('__infoPlist')),
    withPodfile: jest.fn(record('__podfile')),
    withPodfileProperties: jest.fn(record('__podfileProps')),
    // Bypass run-once wrapping so the default export IS `withMyId`.
    createRunOncePlugin: (plugin: unknown) => plugin,
    AndroidConfig: {
      Permissions: {
        withPermissions: jest.fn((config: Record<string, unknown>, permissions: string[]) => {
          config.__permissions = permissions;
          return config;
        }),
      },
    },
    IOSConfig: {
      PrivacyInfo: { withPrivacyInfo: jest.fn((config: unknown) => config) },
    },
    WarningAggregator: { addWarningAndroid: jest.fn() },
  };
});

const MAVEN_URL = 'https://artifactory.myid.uz/artifactory/myid';
const CAMERA_MARKER = 'MyID';

const GRADLE_ALLPROJECTS = `buildscript {
  repositories { google() }
}
allprojects {
  repositories {
    google()
    mavenCentral()
  }
}
`;

const SETTINGS_CENTRAL = `dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
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

const addWarningAndroid = WarningAggregator.addWarningAndroid as jest.Mock;

const tempDirs: string[] = [];
function tempProjectRoot(settingsContents?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'myid-plugin-'));
  tempDirs.push(dir);
  if (settingsContents != null) {
    writeFileSync(join(dir, 'settings.gradle'), settingsContents);
  }
  return dir;
}

function baseConfig(): Record<string, any> {
  return { name: 'test', slug: 'test' };
}

// The default export is `withMyId` (createRunOncePlugin is mocked to identity).
function applyPlugin(props?: unknown): Record<string, any> {
  return (withMyId as unknown as (config: unknown, props?: unknown) => Record<string, any>)(
    baseConfig(),
    props
  );
}

beforeEach(() => {
  addWarningAndroid.mockReset();
});

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('Android permissions + repo mods', () => {
  it('requests CAMERA and INTERNET permissions', () => {
    const config = applyPlugin({});
    expect(config.__permissions).toEqual([
      'android.permission.CAMERA',
      'android.permission.INTERNET',
    ]);
  });

  it('injects the default MyID maven repo into settings.gradle (groovy)', () => {
    const config = applyPlugin({});
    const mod = { modResults: { language: 'groovy', contents: SETTINGS_CENTRAL } };
    const out = config.__settingsGradle(mod);
    expect(out.modResults.contents).toContain(`maven { url "${MAVEN_URL}"`);
  });

  it('honors a custom androidMavenUrl', () => {
    const url = 'https://example.com/repo';
    const config = applyPlugin({ androidMavenUrl: url });
    const mod = { modResults: { language: 'groovy', contents: SETTINGS_CENTRAL } };
    const out = config.__settingsGradle(mod);
    expect(out.modResults.contents).toContain(`maven { url "${url}"`);
  });

  it('leaves a non-groovy (.kts) settings.gradle untouched', () => {
    const config = applyPlugin({});
    const mod = { modResults: { language: 'kotlin', contents: 'no change' } };
    const out = config.__settingsGradle(mod);
    expect(out.modResults.contents).toBe('no change');
  });

  it('injects into allprojects when settings.gradle lacks a DRM repositories block', () => {
    const config = applyPlugin({});
    const root = tempProjectRoot(); // no settings.gradle at all
    const mod = {
      modResults: { language: 'groovy', contents: GRADLE_ALLPROJECTS },
      modRequest: { platformProjectRoot: root },
    };
    const out = config.__projectBuildGradle(mod);
    expect(out.modResults.contents).toContain(`maven { url "${MAVEN_URL}"`);
    expect(addWarningAndroid).not.toHaveBeenCalled();
  });

  it('skips the allprojects injection when settings.gradle centralizes repos', () => {
    const config = applyPlugin({});
    const root = tempProjectRoot(SETTINGS_CENTRAL);
    const mod = {
      modResults: { language: 'groovy', contents: GRADLE_ALLPROJECTS },
      modRequest: { platformProjectRoot: root },
    };
    const out = config.__projectBuildGradle(mod);
    // Untouched — the settings.gradle mod is responsible in this case.
    expect(out.modResults.contents).toBe(GRADLE_ALLPROJECTS);
    expect(out.modResults.contents).not.toContain(MAVEN_URL);
  });

  it('warns when there is neither an allprojects anchor nor a settings DRM block', () => {
    const config = applyPlugin({});
    const root = tempProjectRoot();
    const mod = {
      modResults: { language: 'groovy', contents: 'buildscript {}\n' },
      modRequest: { platformProjectRoot: root },
    };
    config.__projectBuildGradle(mod);
    expect(addWarningAndroid).toHaveBeenCalledTimes(1);
  });

  it('throws for a Kotlin (.kts) root build.gradle', () => {
    const config = applyPlugin({});
    const mod = {
      modResults: { language: 'kotlin', contents: '' },
      modRequest: { platformProjectRoot: tempProjectRoot() },
    };
    expect(() => config.__projectBuildGradle(mod)).toThrow(/Kotlin/);
  });
});

describe('iOS mods', () => {
  it('forces static frameworks in Podfile.properties', () => {
    const config = applyPlugin({});
    const mod = { modResults: {} as Record<string, unknown> };
    const out = config.__podfileProps(mod);
    expect(out.modResults['ios.useFrameworks']).toBe('static');
  });

  it('sets a default camera usage description and no microphone by default', () => {
    const config = applyPlugin({});
    const mod = { modResults: {} as Record<string, unknown> };
    const out = config.__infoPlist(mod);
    expect(out.modResults.NSCameraUsageDescription).toContain(CAMERA_MARKER);
    expect(out.modResults.NSMicrophoneUsageDescription).toBeUndefined();
  });

  it('uses a custom camera permission and adds microphone when provided', () => {
    const config = applyPlugin({
      cameraPermission: 'Cam please',
      microphonePermission: 'Mic please',
    });
    const mod = { modResults: {} as Record<string, unknown> };
    const out = config.__infoPlist(mod);
    expect(out.modResults.NSCameraUsageDescription).toBe('Cam please');
    expect(out.modResults.NSMicrophoneUsageDescription).toBe('Mic please');
  });

  it('preserves an existing camera usage description when no prop is given', () => {
    const config = applyPlugin({});
    const mod = {
      modResults: { NSCameraUsageDescription: 'Existing text' } as Record<string, unknown>,
    };
    const out = config.__infoPlist(mod);
    expect(out.modResults.NSCameraUsageDescription).toBe('Existing text');
  });

  it('does not register a Podfile mod unless firebaseWorkaround is set', () => {
    const config = applyPlugin({});
    expect(config.__podfile).toBeUndefined();
  });

  it('registers a Podfile firebase workaround mod when opted in', () => {
    const config = applyPlugin({ firebaseWorkaround: true });
    expect(typeof config.__podfile).toBe('function');
    const mod = { modResults: { contents: PODFILE } };
    const out = config.__podfile(mod);
    expect(out.modResults.contents).toContain(
      'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'
    );
  });

  it('merges the MyID privacy manifest into config.ios (default props)', () => {
    const config = applyPlugin(undefined); // exercises the `props ?? {}` default
    expect(config.ios.privacyManifests.NSPrivacyAccessedAPITypes).toHaveLength(4);
  });

  it('preserves existing privacy manifest entries while adding MyID entries', () => {
    const config = (withMyId as unknown as (c: unknown, p?: unknown) => Record<string, any>)(
      {
        name: 'test',
        slug: 'test',
        ios: {
          privacyManifests: {
            NSPrivacyAccessedAPITypes: [
              {
                NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryActiveKeyboards',
                NSPrivacyAccessedAPITypeReasons: ['54BD.1'],
              },
            ],
          },
        },
      },
      {}
    );
    const types = config.ios.privacyManifests.NSPrivacyAccessedAPITypes;
    expect(types).toHaveLength(5);
    expect(
      types.some(
        (t: { NSPrivacyAccessedAPIType: string }) =>
          t.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryActiveKeyboards'
      )
    ).toBe(true);
  });
});
