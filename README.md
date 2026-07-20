# @softwhere-uz/react-native-myid

> MyID biometric eKYC (face liveness) for **React Native** & **Expo** — New Architecture, first-class Expo config plugin, maintained.

[![npm](https://img.shields.io/npm/v/@softwhere-uz/react-native-myid.svg)](https://www.npmjs.com/package/@softwhere-uz/react-native-myid)
[![license](https://img.shields.io/badge/license-MIT%20(glue)-blue.svg)](./LICENSE)

> [!WARNING]
> **Unofficial.** This library is **not affiliated with, endorsed by, or maintained by MyID or UZINFOCOM LLC.** It is an independent, correctly-licensed wrapper around MyID's proprietary SDK. See [`NOTICE`](./NOTICE).

---

⚠️ **This README is a stub — full documentation lands in a later build phase.** Quick facts:

- **Foundation:** [Expo Modules API](https://docs.expo.dev/modules/overview/) + a first-class Expo **config plugin**. Works in **bare React Native** and **Expo** (dev/EAS build via `expo prebuild` — **never Expo Go**, because MyID ships custom native code).
- **API:** a single typed async call — `identify(config): Promise<MyIdResult>` — with a discriminated `MyIdError` union. (See `src/`.)
- **You must bring your own MyID contract.** MyID 3.1.x uses a **server-minted `sessionId`** (plus your issued `clientHash` / `clientHashId`). The legacy `clientId` + `passportData` flow was removed by the SDK.
- **Licensing:** MIT on the glue code only. The MyID SDK itself is proprietary and is **referenced, never redistributed**. See [`NOTICE`](./NOTICE).

Provenance: the MyID reference React Native bridge that MyID ships publicly was authored by this project's author ([`MyIdModule.swift` — "Created by Kamronbek Juraev"](https://gitlab.myid.uz/myid-public-code/myid-rn-sdk/-/raw/main/ios/MyIdModule.swift)). This package is the maintained, correctly-packaged, current version of that work.

See [`docs/`](./docs) for architecture decisions and the verified SDK facts.
