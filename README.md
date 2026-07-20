# @softwhere-uz/react-native-myid

**English** · [Русский](README.ru.md) · [O'zbekcha](README.uz.md)

> MyID biometric eKYC (face liveness) for **React Native** & **Expo** — New Architecture, a first-class Expo **config plugin**, and maintained against current MyID SDKs.

[![npm](https://img.shields.io/npm/v/@softwhere-uz/react-native-myid.svg)](https://www.npmjs.com/package/@softwhere-uz/react-native-myid)
[![CI](https://github.com/softwhere-uz/react-native-myid/actions/workflows/ci.yml/badge.svg)](https://github.com/softwhere-uz/react-native-myid/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT%20(glue)-blue.svg)](./LICENSE)

> [!WARNING]
> **Unofficial.** This library is **not affiliated with, endorsed by, or maintained by MyID or UZINFOCOM LLC.** It is an independent, correctly-licensed wrapper around MyID's proprietary SDK. See [`NOTICE`](./NOTICE).

---

## What is this?

[MyID](https://myid.uz) is Uzbekistan's national biometric face-liveness identification service. This package wraps MyID's native iOS and Android SDKs behind a single, typed React Native API and — the headline feature — a **correct, complete, maintained Expo config plugin** so it works in the Expo managed workflow without hand-editing native projects.

> **Provenance.** The public React Native reference bridge that MyID ships was originally authored by this project's author — see the [`Created by Kamronbek Juraev` header in MyID's `MyIdModule.swift`](https://gitlab.myid.uz/myid-public-code/myid-rn-sdk/-/raw/main/ios/MyIdModule.swift). This package is the maintained, correctly-packaged, current version of that work.

## Features

- **One typed call:** `identify(config): Promise<MyIdResult>` with a discriminated `MyIdError` union — a user-cancel is a first-class outcome, not a crash.
- **Expo config plugin** that handles the three things every other wrapper gets wrong on iOS (app-global static frameworks, camera usage description, and the privacy manifest) plus the Android Maven repository.
- **New Architecture** (works on the old architecture too, RN 0.74+).
- **Bare React Native and Expo** from one package.
- **Dev/mock mode** so you can build and demo the success/error UI with no MyID contract.
- **Never bundles the proprietary SDK** — it is referenced, not redistributed ([licensing](#licensing)).

## Requirements & how MyID works

MyID is a gated, contract-based service. This library **cannot remove that gate** — you provide:

| You need | From | Notes |
|---|---|---|
| `clientHash`, `clientHashId` | MyID sales (partnership) | Issued to authorized banks / fintech / telecom / gov. |
| A per-launch `sessionId` | **Your own backend** | The modern 3.1.x flow is **session-based** — your server mints a `sessionId` from MyID's session API. The legacy `clientId` + `passportData` flow was removed by the SDK. |
| A physical device | — | Face liveness needs a real camera; simulators/emulators can't complete it. |

> **"Managed" does not mean Expo Go.** MyID ships custom native code, so it can **never** run in Expo Go. "Expo support" means Continuous Native Generation: the config plugin + `npx expo prebuild`, run as a **development build / EAS build**.

## Installation

```sh
npm install @softwhere-uz/react-native-myid
# or: yarn add / bun add / pnpm add
```

### Expo (recommended)

Add the config plugin to your app config, then create a development build.

```json
// app.json
{
  "expo": {
    "plugins": [
      [
        "@softwhere-uz/react-native-myid",
        { "cameraPermission": "We use the camera to verify your identity with MyID." }
      ]
    ]
  }
}
```

```sh
npx expo prebuild            # generates ios/ and android/ with everything configured
npx expo run:ios             # or run:android — a dev build, not Expo Go
```

### Bare React Native

Run `npx expo prebuild` once (Expo Modules works in bare RN), or configure the native projects manually:

- **iOS** — in your `Podfile`, enable app-global static frameworks (`use_frameworks! :linkage => :static`), add `NSCameraUsageDescription` to `Info.plist`, and add the required-reason API codes to `PrivacyInfo.xcprivacy` (see [the plugin source](./plugin/src/index.ts) for the exact codes). `pod install` pulls `MyIdSDK` from CocoaPods trunk automatically (declared by this package's podspec).
- **Android** — add the MyID Maven repository to your root `build.gradle` `allprojects { repositories { … } }`: `maven { url "https://artifactory.myid.uz/artifactory/myid" }`. The SDK dependency itself is declared by this package.

## Config plugin options

| Prop | Type | Default | Description |
|---|---|---|---|
| `cameraPermission` | `string` | a sensible default | iOS `NSCameraUsageDescription`. |
| `microphonePermission` | `string` | — (omitted) | iOS `NSMicrophoneUsageDescription`. Off by default — MyID face liveness is camera-only. |
| `androidMavenUrl` | `string` | `https://artifactory.myid.uz/artifactory/myid` | Public MyID Maven repo. **Never** put credentials here — they leak into the APK/AAB. |
| `firebaseWorkaround` | `boolean` | `false` | Opt-in Podfile `post_install` workaround for the app-global static-frameworks / Firebase (non-modular header) conflict. Validate on-device. |

## Usage

```ts
import { identify, isMyIdError, type MyIdConfig } from '@softwhere-uz/react-native-myid';

async function verify() {
  const config: MyIdConfig = {
    sessionId,     // minted per-launch by YOUR backend
    clientHash,    // issued by MyID
    clientHashId,  // issued by MyID
    environment: 'PRODUCTION',   // or 'SANDBOX'
    // optional: entryType, locale, residency, cameraShape, minAge, showErrorScreen, …
  };

  try {
    const result = await identify(config);
    // Send result.code to YOUR backend and verify it against MyID — never trust the client alone.
    console.log(result.code, result.base64Image, result.comparison);
  } catch (error) {
    if (isMyIdError(error)) {
      switch (error.kind) {
        case 'cancelled':  return; // user closed the flow — not an error
        case 'permission': return promptForCameraPermission();
        case 'network':    return retryLater();
        default:           return reportError(error.kind, error.code, error.nativeMessage);
      }
    }
    throw error;
  }
}
```

### API

- `identify(config: MyIdConfig): Promise<MyIdResult>` — launches the flow. Resolves on success; rejects with a `MyIdError` otherwise (including a normal user-cancel, `kind: 'cancelled'`).
- `MyIdResult` — `{ code: string; base64Image?: string; comparison?: number }`. `base64Image` is a PNG (no data-URI prefix), normalized across platforms. `comparison` is absent on iOS 3.1.3.
- `MyIdError` — `Error` with `kind: 'cancelled' | 'permission' | 'network' | 'sdk' | 'no_activity' | 'config' | 'unknown'`, plus optional `code` (raw SDK code) and `nativeMessage`. `isMyIdError(e)` narrows it.
- **Verify the result server-side.** `code` is an identification handle; confirm it from your backend against MyID.

### Dev / mock mode

Demo the success and error UI with no MyID contract:

```ts
import { setMockMode, identify } from '@softwhere-uz/react-native-myid';

setMockMode({ outcome: 'success' });    // 'cancelled' | 'permission' | 'network' | 'sdk' | …
const result = await identify(anyConfig); // resolves a fake result without touching native
setMockMode(null);                        // back to the real flow
```

See [`example/`](./example) for a full app with a scenario picker.

## Platform notes

- **iOS static frameworks.** MyIdSDK is a Swift `xcframework` that requires app-global static frameworks. The config plugin sets this, but it can conflict with Firebase/gRPC — enable `firebaseWorkaround` if you hit non-modular-header errors.
- **Android Huawei / no-Google-Play.** Pass `huaweiAppId` at runtime in `MyIdConfig` (not a separate `-bundled` artifact, which no longer exists).
- **SDK versions.** iOS `MyIdSDK ~> 3.1.3`, Android `uz.myid.sdk.capture:myid-capture-sdk:3.1.9` (pinned stable). See [`docs/DECISIONS.md`](./docs/DECISIONS.md) for the verified coordinates and API.

## Licensing

The code in this repository is **MIT**-licensed — but that covers **only the glue** (the TypeScript API, the Expo config plugin, and the iOS/Android bridge sources). The underlying **MyID SDK is proprietary** (iOS: "Commercial"; Android: all-rights-reserved) and is **referenced, never redistributed** by this package. Production use requires a MyID partnership. See [`NOTICE`](./NOTICE).

## Contributing / development

```sh
npm install
npm run build && npm run build:plugin
npm test          # 32 unit tests (API + config plugin, no device needed)
npm run lint && npm run typecheck
```

The [`example/`](./example) app exercises the module end-to-end. See [`docs/DECISIONS.md`](./docs/DECISIONS.md) for architecture and the verified SDK facts.

## Acknowledgements

MyID and UZINFOCOM LLC for the SDK. This is an independent, unofficial wrapper.
