import {
  AndroidConfig,
  ConfigPlugin,
  IOSConfig,
  createRunOncePlugin,
  withInfoPlist,
  withPodfile,
  withPodfileProperties,
  withProjectBuildGradle,
} from '@expo/config-plugins';

const PLUGIN_NAME = '@softwhere-uz/react-native-myid';
const PLUGIN_VERSION = '0.1.0';

const DEFAULT_MAVEN_URL = 'https://artifactory.myid.uz/artifactory/myid';
const DEFAULT_CAMERA_PERMISSION =
  'Allow $(PRODUCT_NAME) to access your camera to verify your identity with MyID.';

const MAVEN_MARKER = 'react-native-myid: MyID SDK maven repository';
const FIREBASE_MARKER = 'react-native-myid: relax non-modular includes for static frameworks';

/** Configuration for the `@softwhere-uz/react-native-myid` Expo config plugin. */
export interface MyIdPluginProps {
  /**
   * iOS `NSCameraUsageDescription`. MyID performs face capture, so a camera
   * permission string is mandatory on iOS. A sensible default is used if unset.
   */
  cameraPermission?: string;
  /**
   * iOS `NSMicrophoneUsageDescription`. Only added when provided — MyID face
   * liveness is camera-only in every 3.x source we verified, so this is off by
   * default. Set it only if your MyID flow records audio.
   */
  microphonePermission?: string;
  /**
   * Android Maven repository that serves the MyID SDK. Defaults to the public,
   * no-auth MyID Artifactory. Do not put credentials here — they would leak
   * into the APK/AAB.
   */
  androidMavenUrl?: string;
  /**
   * Opt in to a Podfile `post_install` workaround for the app-global static
   * frameworks / Firebase (non-modular header) conflict. Off by default so
   * non-Firebase apps are unaffected. Community-reported; validate on-device.
   */
  firebaseWorkaround?: boolean;
}

/** A single required-reason API entry in an iOS privacy manifest. */
export interface PrivacyAccessedApiType {
  NSPrivacyAccessedAPIType: string;
  NSPrivacyAccessedAPITypeReasons: string[];
}

/**
 * The required-reason API declarations for the MyID iOS SDK, extracted verbatim
 * from the `PrivacyInfo.xcprivacy` shipped inside `MyIdSDK.xcframework` (3.1.3).
 * Under app-global static frameworks Apple does not reliably read the pod's own
 * manifest, so the app must declare these itself — do not invent the codes.
 */
export const MYID_PRIVACY_ACCESSED_API_TYPES: PrivacyAccessedApiType[] = [
  {
    NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
    NSPrivacyAccessedAPITypeReasons: ['0A2A.1'],
  },
  {
    NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
    NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
  },
  {
    NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
    NSPrivacyAccessedAPITypeReasons: ['85F4.1'],
  },
  {
    NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
    NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
  },
];

// ---------------------------------------------------------------------------
// Pure, idempotent helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Inject a Maven repository into the root `build.gradle`'s
 * `allprojects { repositories { … } }` block (the Expo Android template puts
 * app-wide repos there). Idempotent: a no-op if the URL is already present, and
 * a no-op if there is no `allprojects` block to target.
 */
export function addMavenRepository(contents: string, url: string): string {
  if (contents.includes(url)) {
    return contents;
  }
  const anchor = /allprojects\s*\{[\s\S]*?repositories\s*\{/;
  const match = contents.match(anchor);
  if (match == null || match.index == null) {
    return contents;
  }
  const insertAt = match.index + match[0].length;
  const injection = `\n    // ${MAVEN_MARKER}\n    maven { url "${url}" }`;
  return contents.slice(0, insertAt) + injection + contents.slice(insertAt);
}

/**
 * Merge MyID's required-reason API types into an existing list, deduplicating
 * by category and unioning reason codes. Idempotent.
 */
export function mergePrivacyAccessedApiTypes(
  existing: PrivacyAccessedApiType[] = []
): PrivacyAccessedApiType[] {
  const result: PrivacyAccessedApiType[] = existing.map((entry) => ({
    NSPrivacyAccessedAPIType: entry.NSPrivacyAccessedAPIType,
    NSPrivacyAccessedAPITypeReasons: [...(entry.NSPrivacyAccessedAPITypeReasons ?? [])],
  }));
  for (const required of MYID_PRIVACY_ACCESSED_API_TYPES) {
    const found = result.find(
      (e) => e.NSPrivacyAccessedAPIType === required.NSPrivacyAccessedAPIType
    );
    if (found) {
      const reasons = new Set([
        ...found.NSPrivacyAccessedAPITypeReasons,
        ...required.NSPrivacyAccessedAPITypeReasons,
      ]);
      found.NSPrivacyAccessedAPITypeReasons = [...reasons];
    } else {
      result.push({
        NSPrivacyAccessedAPIType: required.NSPrivacyAccessedAPIType,
        NSPrivacyAccessedAPITypeReasons: [...required.NSPrivacyAccessedAPITypeReasons],
      });
    }
  }
  return result;
}

/**
 * Inject a `post_install` snippet that relaxes non-modular header includes for
 * all pods — the common workaround for the app-global static frameworks /
 * Firebase conflict. Injected inside the existing Expo `post_install` block.
 * Idempotent; a no-op if there is no `post_install` block.
 */
export function addFirebasePostInstall(contents: string): string {
  if (contents.includes(FIREBASE_MARKER)) {
    return contents;
  }
  const anchor = 'post_install do |installer|';
  const insertAt = contents.indexOf(anchor);
  if (insertAt === -1) {
    return contents;
  }
  const after = insertAt + anchor.length;
  const snippet =
    `\n    # ${FIREBASE_MARKER}\n` +
    `    installer.pods_project.targets.each do |t|\n` +
    `      t.build_configurations.each do |bc|\n` +
    `        bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'\n` +
    `      end\n` +
    `    end`;
  return contents.slice(0, after) + snippet + contents.slice(after);
}

// ---------------------------------------------------------------------------
// Config-plugin mods
// ---------------------------------------------------------------------------

const withMyIdAndroid: ConfigPlugin<MyIdPluginProps> = (config, props) => {
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.CAMERA',
    'android.permission.INTERNET',
  ]);

  const url = props.androidMavenUrl ?? DEFAULT_MAVEN_URL;
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language === 'groovy') {
      mod.modResults.contents = addMavenRepository(mod.modResults.contents, url);
    } else {
      throw new Error(
        `[${PLUGIN_NAME}] Cannot add the MyID Maven repository to a Kotlin (.kts) root build.gradle. ` +
          `Add \`maven { url "${url}" }\` to your allprojects/repositories manually.`
      );
    }
    return mod;
  });
};

const withMyIdIos: ConfigPlugin<MyIdPluginProps> = (config, props) => {
  // (1) App-global static frameworks — required by MyIdSDK's Swift xcframework.
  config = withPodfileProperties(config, (mod) => {
    mod.modResults['ios.useFrameworks'] = 'static';
    return mod;
  });

  // (2) Camera (and optional microphone) usage descriptions.
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSCameraUsageDescription =
      props.cameraPermission ??
      (mod.modResults.NSCameraUsageDescription as string | undefined) ??
      DEFAULT_CAMERA_PERMISSION;
    if (props.microphonePermission) {
      mod.modResults.NSMicrophoneUsageDescription = props.microphonePermission;
    }
    return mod;
  });

  // (3) Privacy manifest required-reason APIs (Apple ignores the pod's own
  //     manifest under static frameworks).
  config.ios = config.ios ?? {};
  const manifests = config.ios.privacyManifests ?? {};
  config.ios.privacyManifests = {
    ...manifests,
    NSPrivacyAccessedAPITypes: mergePrivacyAccessedApiTypes(manifests.NSPrivacyAccessedAPITypes),
  };
  config = IOSConfig.PrivacyInfo.withPrivacyInfo(config);

  // (4) Optional Firebase / static-frameworks escape hatch (off by default).
  if (props.firebaseWorkaround) {
    config = withPodfile(config, (mod) => {
      mod.modResults.contents = addFirebasePostInstall(mod.modResults.contents);
      return mod;
    });
  }

  return config;
};

const withMyId: ConfigPlugin<MyIdPluginProps | void> = (config, props) => {
  const resolved: MyIdPluginProps = props ?? {};
  config = withMyIdIos(config, resolved);
  config = withMyIdAndroid(config, resolved);
  return config;
};

export default createRunOncePlugin(withMyId, PLUGIN_NAME, PLUGIN_VERSION);
