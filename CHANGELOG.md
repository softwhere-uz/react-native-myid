# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/softwhere-uz/react-native-myid/commits/main
