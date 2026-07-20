# Architecture decisions & verified SDK facts

> Companion to [`HANDOVER.md`](./HANDOVER.md). Everything here was **verified against
> primary sources or by inspecting the actual SDK binaries** on 2026-07-20. Where this
> doc and the HANDOVER disagree, **this doc wins** (it corrects a few HANDOVER assumptions).

## 1. Foundation: Expo Modules API (not Nitro)

Confirmed with the maintainer. The native surface is a **single cold async call**
(`identify()`) that opens a full-screen camera flow and resolves once — there is no hot
path, so Nitro's JSI/synchronous advantage delivers nothing measurable here. Expo Modules
API gives us the first-class **config plugin** (the actual differentiator) in the same
package, a clean Swift/Kotlin DSL (`AsyncFunction`/`OnActivityResult`), New-Architecture
support **and** old-arch/RN-0.74+ reach, and forces no extra peer dependency on consumers.
Nitro is Expo-prebuild-compatible today, but would add `react-native-nitro-modules` +
codegen for zero benefit and still require us to hand-write the same config-plugin mods.

## 2. Pinned SDK coordinates (verified live 2026-07-20)

| Platform | Coordinate | Version | Notes |
|---|---|---|---|
| iOS | CocoaPods `MyIdSDK` | **`~> 3.1.3`** | latest stable; iOS **13.0**; license **Commercial**; `use_frameworks! :linkage => :static` **required**; vendored `MyIdSDK.xcframework`, zero pod deps |
| Android | `uz.myid.sdk.capture:myid-capture-sdk` | **`3.1.9`** (release) + `myid-capture-sdk-debug:3.1.9` (debug) | minSdk **21**, targetSdk 36, Kotlin 1.8.22+, Java 8, AndroidX; ships native `.so` for 4 ABIs (~29 MB aar) |
| Android Maven | `https://artifactory.myid.uz/artifactory/myid` | — | **public read, NO auth** — never bake credentials into `extraMavenRepos` (leaks into APK/AAB) |

**Corrections to HANDOVER §6:**

1. **Pin `3.1.9`, not the metadata `<release>`.** The Android `maven-metadata.xml`
   `<latest>`/`<release>` both point to `3.1.10-beta02` (a **beta**). Never resolve with
   `+` / `latest.release` — pin `3.1.9` explicitly.
2. **The `-bundled` (Huawei) variant does not exist.** Verified 404 on both hosts. Huawei /
   no-Google-Play-Services is handled via `MyIdConfig.withHuaweiAppId(appId)`, **not** an
   artifact swap. The plugin's `huaweiAppId` prop passes an app id.
3. **Maven host:** prefer `artifactory.myid.uz` (current MyID docs). `artifactory.aigroup.uz`
   is a live, identical mirror used by older samples.
4. **Java package ≠ Maven groupId.** Kotlin package is `uz.myid.android.sdk.capture`;
   Maven groupId is `uz.myid.sdk.capture`.

## 3. The flow changed: 3.1.x is session-based; the legacy `clientId` flow is GONE

Verified by inspecting the actual binaries (iOS `MyIdSDK.xcframework` swiftinterface @3.1.3;
Android `myid-capture-sdk` aar @2.3.0 vs @3.1.9 via `javap`):

- **Legacy (2.x):** `MyIdConfig.Builder(clientId).withClientHash(...).withPassportData(...).withBirthDate(...).withBuildMode(...)`.
- **Modern (3.1.x):** `MyIdConfig.Builder(sessionId).withClientHash(clientHash, clientHashId).withEnvironment(...)`. **`clientId`, `passportData`, `dateOfBirth`, `buildMode` are removed.**

We standardize on the **modern session flow** (matches the pinned SDKs and the "current /
maintained" thesis). Consequence: the demo repo's credentials (`clientId` + `passportData`)
**cannot** drive a 3.1.x build — the consumer must supply a per-launch **`sessionId`** minted
server-side (from MyID's session API using their `clientHash` / `clientHashId`).

## 4. Native API contract (empirically verified)

**iOS `MyIdSDK` 3.1.3** — property-based config; delegate callbacks:
```
MyIdConfig { sessionId, clientHash, clientHashId, residency(MyIdResidency: userDefined/resident/nonResident),
  minAge, distance, environment(MyIdEnvironment: debug/production),
  entryType(MyIdEntryType: identification/videoIdentification/faceDetection),
  locale(MyIdLocale: uzbek/english/russian), cameraShape(circle/ellipse),
  cameraSelector(front/back), presentationStyle(full/sheet), organizationDetails,
  appearance(MyIdAppearance: colors + buttonCornerRadius), showErrorScreen }
MyIdClient.start(withConfig:withDelegate:)   // also buildMyIdViewController(...) -> UINavigationController
MyIdClientDelegate { onSuccess(result:), onError(exception:), onUserExited(), onEvent(event: MyIdEvent) }
MyIdResult { code: String, image: UIImage? }         // NOTE: no comparison score on iOS 3.1.3
MyIdException { message: String, code: Int, ttl: NSNumber? }   // ttl = ban countdown
MyIdEvent: cameraOpen / faceInPosition / faceCaptured / backendRequested / backendResponded
```

**Android `myid-capture-sdk` 3.1.9** — builder + activity-result:
```
MyIdConfig.Builder(sessionId)
  .withClientHash(clientHash, clientHashId).withEnvironment(MyIdEnvironment)
  .withEntryType(MyIdEntryType).withLocale(MyIdLocale).withResidency(MyIdResidency)
  .withCameraShape(..).withCameraSelector(..).withCameraResolution(..).withImageFormat(..)
  .withScreenOrientation(..).withMinAge(..).withDistance(..).withErrorScreen(bool)
  .withSoundGuides(bool).withOrganizationDetails(..).withHuaweiAppId(String).build()
MyIdClient(): createIntent(activity, config); startActivityForResult(activity, reqCode, config, listener);
              handleActivityResult(resultCode, listener); getGraphicFieldImageByType(MyIdGraphicFieldType) -> Bitmap
MyIdResultListener { onSuccess(MyIdResult), onError(MyIdException), onUserExited() }
```

**Cross-platform normalizations we own (bug classes fixed):**
- Success image → **one key `base64Image`, one format PNG** on both platforms (references
  disagree: iOS emitted JPEG, Android PNG). Android: **null-safe**, never force-unwrap.
- `onUserExited` is a **distinct `cancelled` outcome**, never a generic error.
- `comparison` is **optional** (absent on iOS 3.1.3).

## 5. TypeScript API (what we expose)

```ts
identify(config: MyIdConfig): Promise<MyIdResult>;

interface MyIdConfig {           // required
  sessionId: string; clientHash: string; clientHashId: string;
  // optional
  environment?: 'SANDBOX' | 'PRODUCTION';            // default PRODUCTION -> native .production
  entryType?: 'IDENTIFICATION' | 'FACE_DETECTION' | 'VIDEO_IDENTIFICATION';
  locale?: 'UZ' | 'RU' | 'EN';
  residency?: 'RESIDENT' | 'NON_RESIDENT' | 'USER_DEFINED';
  cameraShape?: 'CIRCLE' | 'ELLIPSE';
  minAge?: number; distance?: number; showErrorScreen?: boolean;
  organizationDetails?: { phoneNumber?: string; logo?: string };
  appearance?: MyIdAppearance; huaweiAppId?: string;  // huaweiAppId: Android/HMS only
}
interface MyIdResult { code: string; base64Image?: string; comparison?: number; }
type MyIdErrorKind = 'cancelled' | 'permission' | 'network' | 'sdk' | 'no_activity' | 'config' | 'unknown';
interface MyIdError extends Error { kind: MyIdErrorKind; code?: number; nativeMessage?: string; }
```
`code` is an identification handle — **verify it against MyID's backend from your server**;
never trust the client result alone.

## 6. iOS privacy manifest — REAL required-reason codes (from the shipped 3.1.3 framework)

The config plugin must inject these into the app's `PrivacyInfo.xcprivacy` (under static
frameworks Apple does not reliably read the pod's own manifest):

| Accessed API category | Reason code |
|---|---|
| `NSPrivacyAccessedAPICategoryFileTimestamp` | `0A2A.1` |
| `NSPrivacyAccessedAPICategorySystemBootTime` | `35F9.1` |
| `NSPrivacyAccessedAPICategoryDiskSpace` | `85F4.1` |
| `NSPrivacyAccessedAPICategoryUserDefaults` | `CA92.1` |

Camera usage string (`NSCameraUsageDescription`) is required; **no microphone** — every
3.x source is camera-only (confirm against the partner README before shipping).

## 7. Prerequisites & testability

- **Cold-verifiable (CI + simulator/emulator, no credentials):** types compile, config plugin
  applies idempotently, `expo prebuild` injects the 3 iOS mods + Android maven dep, both apps
  build + launch, `identify()` is callable, and every failure path (`cancelled` / `permission`
  / bad-session `sdk`) rejects with a correctly-typed `MyIdError`.
- **Needs a physical device + a real MyID sandbox contract (not fakeable, not in CI):** a
  successful `identify()` with a real face + `code`, and backend verification of that `code`.
- Device for the happy-path test: a **physical iPhone** (confirmed available). MyID `sessionId`
  minting is the outstanding gate for the live success test.
