# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.5] - 2026-07-26

### Added

- **Config plugin now supports `settings.gradle` dependency resolution.** On modern
  Gradle/AGP templates that centralize repositories under
  `dependencyResolutionManagement { repositories { … } }` (including
  `repositoriesMode = FAIL_ON_PROJECT_REPOS`), the MyID Maven repo is injected there and
  the root `allprojects` injection is skipped so it can't fail the build. Older templates
  keep the `allprojects` path unchanged. When neither location exists, the plugin now
  emits a prebuild warning instead of silently shipping a build that can't resolve the SDK.
  (Surfaced by auditing competing wrappers, several of which hit this on newer Expo/RN.)

### Changed

- **iOS `MyIdSDK` is now pinned to an exact version (`3.1.3`, was `~> 3.1.3`)** so an
  untested MyID SDK patch can't silently resolve into a build — matching the exact Android
  pin and the library's "never floated" guarantee. MyID versions its iOS and Android SDKs
  independently (iOS 3.1.3, Android 3.1.9), so the two pins differ by design.
- The iOS podspec and Android Gradle module versions now track the package version (they
  were stale at `0.1.0`).

## [0.1.4] - 2026-07-25

### Fixed

- **Android: a failed launch no longer wedges the module.** If `identify()` threw
  while starting the native flow (e.g. the config builder rejected a value, or the
  Activity could not start), the pending-promise slot was left set, so every later
  call rejected with "A MyID flow is already in progress." until the app restarted.
  The launch path is now guarded and settles a typed `sdk` error instead.

### Changed

- `peerDependencies` now declare real floors — `expo >=51`, `react >=18`,
  `react-native >=0.74` — instead of `*`, matching the documented support surface.
- Docs (README EN/RU/UZ): corrected the stated iOS platform floor. The pod targets
  iOS 15.1; the MyID SDK itself supports 13.0, and your Expo/React Native toolchain
  sets the effective minimum (Expo SDK 57's `ExpoModulesCore` requires iOS 16.4).
  Clarified that current Expo SDKs are New-Architecture-only and legacy architecture
  applies only to bare React Native. Marked `appearance` as iOS-only, and documented
  that `MyIdError` `kind: 'network'` is currently produced only by mock mode.

## [0.1.3] - 2026-07-23

### Changed

- The config plugin's `createRunOncePlugin` version is now resolved from
  `package.json` at runtime, so releases never touch plugin source.
- README: added "Guides & articles" (Medium integration guide); full Russian
  and Uzbek translations linked from the npm page now render complete docs.

## [0.1.2] - 2026-07-22

### Fixed

- **npm was displaying the wrong README.** Root-level `README*` files are always
  packed, and the registry picked the near-empty `README.uz.md` translation
  scaffold as the package readme. The RU/UZ scaffolds moved to `docs/i18n/`, so
  npmjs.com now renders the full English README.

### Changed

- Expanded npm `keywords` (face-liveness, liveness-detection, myid-sdk,
  identification, verification, uzinfocom, expo-module) for search relevance.

## [0.1.1] - 2026-07-22

Docs and CI release — no runtime or API changes.

### Added

- Presentation-grade README: end-to-end MyID session-flow guide (official
  endpoints and TTLs, sequence diagram, backend session-minting example), full
  typed API reference, SDK error-code mapping with real device-captured
  messages, verified bare-React-Native install steps (incl. the Xcode 26
  `internal import Expo` note), troubleshooting table, security checklist, and
  a comparison with the other React Native MyID wrappers — every claim
  live-verified 2026-07-22.
- On-device E2E verification (2026-07-22, physical iPhone): Expo dev build and
  a bare RN 0.86 app installed from the packed tarball — native module
  registration, mock API, config validation, and a real `MyIdClient.start`
  round trip to the MyID SANDBOX backend, all passing.

### Changed

- CI: docs-only changes now skip the native iOS/Android builds and prebuild
  assertions (paths-filter gate); the fast lint/typecheck/build/test job still
  runs on every PR.
- Releases publish to npm via GitHub Actions **Trusted Publishing** (OIDC,
  tokenless) with provenance attestation, triggered by `v*` tags.

## [0.1.0] - 2026-07-20

### Added

- Initial library: `identify(config): Promise<MyIdResult>` wrapping the MyID
  biometric eKYC SDK for React Native & Expo (New Architecture), modeling the
  verified MyID **3.1.x session flow** (`sessionId` + `clientHash` + `clientHashId`).
- Discriminated `MyIdError` union (`cancelled` / `permission` / `network` / `sdk`
  / `no_activity` / `config` / `unknown`) with an `isMyIdError` type guard;
  user-cancel is a first-class outcome.
- First-class **Expo config plugin**: app-global static frameworks,
  `NSCameraUsageDescription`, the MyID `PrivacyInfo.xcprivacy` required-reason
  codes, the Android Maven repository, and an opt-in Firebase static-frameworks
  escape hatch.
- iOS (Swift) and Android (Kotlin) native modules via the Expo Modules API,
  referencing (never bundling) `MyIdSDK ~> 3.1.3` (iOS) and
  `uz.myid.sdk.capture:myid-capture-sdk:3.1.9` (Android).
- Dev/mock mode (`setMockMode`) for demoing without a MyID contract.
- Example app (Expo, Continuous Native Generation) with a scenario picker.
- CI (GitHub Actions): lint, typecheck, build, tests, config-plugin prebuild
  assertions, and iOS + Android build gates.

[Unreleased]: https://github.com/softwhere-uz/react-native-myid/compare/v0.1.5...HEAD
[0.1.5]: https://github.com/softwhere-uz/react-native-myid/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/softwhere-uz/react-native-myid/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/softwhere-uz/react-native-myid/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/softwhere-uz/react-native-myid/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/softwhere-uz/react-native-myid/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/softwhere-uz/react-native-myid/releases/tag/v0.1.0
