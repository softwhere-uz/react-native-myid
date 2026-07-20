# HANDOVER — `@softwhere-uz/react-native-myid`

> Context transfer for continuing this project in a fresh Claude Code session.
> Everything below is **verified research + locked decisions**. Don't re-derive it — build on it.
> Last updated: 2026-07-20.

---

## 0. TL;DR for the next session

We are building a **polished, standalone React Native + Expo library** that wraps
**MyID** (Uzbekistan's national biometric face-liveness eKYC SDK, by UZINFOCOM LLC).

- **Repo:** https://github.com/softwhere-uz/react-native-myid (created, currently empty except this file)
- **npm name (decided):** `@softwhere-uz/react-native-myid` (scope confirmed free on npm)
- **Foundation (decided):** Expo Module (`create-expo-module`) + a first-class Expo **config plugin**. Works in **both** bare RN and Expo.
- **The differentiator (decided):** the *correct, complete, current, maintained* Expo config plugin — see §4.
- **The author's real edge:** provenance — MyID's official code already ships his bridge (see §2).
- **Hard rule:** NEVER bundle the native SDK binary. Reference it as an external dependency. MIT-license the glue only. See §3 (this is a legal blocker).

**Next concrete step:** verify current MyID SDK coordinates against live docs (§6), then scaffold with `create-expo-module` and implement the config plugin (§7).

---

## 1. Who / why

- **Author:** Kamronbek Juraev (GitHub `KAMRONBEK`), publishing under the **`softwhere-uz`** GitHub org / npm scope.
- **Goal:** a portfolio-grade, correctly-licensed, well-maintained MyID library for React Native — with best-in-class Expo managed-workflow support as the headline feature.
- **Honest framing:** this is a **provenance / portfolio / reputation play into a small, already-served niche**, NOT a growth bet. Total market usage is tiny (see §5). Proceed for the credibility + the clean flagship under the org, not for downloads.

---

## 2. The provenance asset (verified — this is the marketing story)

MyID's **official** public GitLab ships the author's bridge code with his authorship header intact:

- `https://gitlab.myid.uz/myid-public-code/myid-rn-sdk/-/raw/main/ios/MyIdModule.swift`
  → opens with `// Created by Kamronbek Juraev, 23/07/2024`.
- That official `myid-rn-sdk` repo is a **bare demo app**, not a library: `package.json` name `"MyID"`, `version 0.0.1`, `private: true`, stock RN-CLI README, "No license", 4 commits. It is **not** published to npm.
- The author's own `github.com/KAMRONBEK/myid-react-native` is likewise a bare demo (old-bridge `NativeModules`, `newArchEnabled: false`, stale SDK 2.3.x).

**Use this in the README** (honestly, nominatively): *"The RN bridge MyID shipped as their reference is mine; this is the maintained, correctly-packaged, current version of it."*

---

## 3. LICENSING — the blocker (do NOT get this wrong)

Verified from primary sources:

- **iOS `MyIdSDK` CocoaPods podspec license = `"Commercial"`** (not a redistribution grant).
- **Android AAR `uz.myid.sdk.capture:myid-capture-sdk` POM has no `<licenses>` block** → all-rights-reserved.
- The MIT licenses seen on wrappers/samples cover only the **thin glue code**, never the native binary.

**Rules:**
1. **Never bundle / vendor the MyID binary** into the npm tarball. That would be unauthorized redistribution.
2. **Reference it as an external dependency** the consumer resolves:
   - Android: Maven repo `https://artifactory.aigroup.uz:443/artifactory/myid` — **public read, no auth** for release artifacts. Declare `implementation "uz.myid.sdk.capture:myid-capture-sdk:<ver>"`.
   - iOS: public CocoaPods trunk pod `MyIdSDK`.
3. **MIT-license only your glue code**, and add a `NOTICE` stating the MyID SDK itself is proprietary/Commercial, is not redistributed by this package, and requires a MyID partnership.
4. Every consuming app **still needs its own MyID contract + `clientHash` / `clientHashId` / `sessionId`** (issued by MyID sales to authorized banks/fintech/telecom/gov). The library cannot remove that gate — document it prominently.

**Open legal question to close before publishing:** read `https://myid.uz/en/agreement/` and email `myid@uzinfocom.uz` asking whether a public, MIT-glue, unofficial wrapper (referencing, not redistributing, their SDK) is permitted. Ideally get a one-line blessing to cite in the README.

---

## 4. The differentiator — Expo config plugin (verified gap)

We inspected the published files of all 5 existing RN MyID libs. On Expo config-plugin support:

| Package | Config plugin? | Managed-ready? | Notes |
|---|---|---|---|
| `expo-myid` (0.1.81) | ✅ yes | ⚠️ partial, **stale + incomplete** | thin `withBuildProperties` wrapper; **skips all 3 iOS requirements below**; pins stale 2.x; abandoned Nov 2024 |
| `rn-myid` (1.0.8) | ❌ no | iOS = manual Info.plist edits | TurboModule, current 3.1.x, self-injects Android Maven |
| `react-native-nitro-myid` (0.1.3) | ❌ no | manual native edits | Nitro/JSI |
| `@maydon_tech/react-native-myid` (1.1.3) | ❌ no | manual native edits | dual arch, usage leader (~140 dl/mo) |
| `react-native-myid` (0.1.8) | ❌ no | manual native edits | legacy-arch, stale SDK |

**Verdict:** the gap is **real but not empty**. One stale, incomplete Expo module exists. Nobody ships a *correct, complete, current, maintained* config plugin. So the pitch is **"the correct/complete/maintained one,"** NOT "the first."

### The 3 hard iOS requirements every competitor gets wrong (where we win)

1. **App-global static frameworks.** MyIdSDK requires `use_frameworks! :linkage => :static`. Expo applies this **app-wide with no per-pod override** → commonly breaks Firebase / gRPC / GoogleUtilities. **Set it correctly AND ship a documented `post_install` escape hatch** for the Firebase conflict. This is the #1 real-world failure mode.
2. **`NSCameraUsageDescription`** (+ `NSMicrophoneUsageDescription` if liveness records audio). Missing → hard crash on first camera use + App Store rejection. Expose as a plugin prop with a sensible default.
3. **`PrivacyInfo.xcprivacy`.** Under static frameworks Apple does **not** reliably parse the pod's bundled privacy manifest, so the app must hand-aggregate MyID's required-reason API codes into its own manifest. Most-missed; only bites silently at App Store upload. Pull the real codes from MyID's shipped manifest — don't invent them.

### "Managed" ≠ Expo Go (must say this in the README)

MyID has custom native code → it can **never** run in Expo Go. "Expo managed support" = **Continuous Native Generation** (config plugin + `npx expo prebuild`) running as a **development build / EAS build**. Be explicit or you'll get "doesn't work in Expo Go" issues on day one.

---

## 5. Market reality (verified — overturned the original premise)

The author's starting assumption was "nothing exists for bare RN." **False as of mid-2026** — 5 third-party npm libs already exist (see §4 table). Usage is tiny (top ~140 downloads/month). Compete on **provenance + quality + maintenance + the Expo plugin**, not novelty or first-mover.

---

## 6. Native SDK facts + coordinates (verify latest before shipping)

- **Android:** `uz.myid.sdk.capture:myid-capture-sdk:<ver>` (release) from Maven `https://artifactory.aigroup.uz:443/artifactory/myid` (public read).
  - Huawei / no-Google-Play-Services builds → `-bundled` variant.
  - minSdk ≥ 21 (Expo SDK 56 default 24 is fine — don't downgrade), AndroidX, Kotlin ≥ 1.8.22, Java 8 compileOptions (Expo toolchain satisfies this).
  - **Target `3.1.9`** (new flow) — NOT the stale 2.3.x the demo repos use.
- **iOS:** CocoaPods `pod 'MyIdSDK', '~> 3.1.3'`, iOS 13+, **requires static frameworks**.
- **Runtime config the caller supplies:** `clientHash`, `clientHashId` (from MyID sales), and a per-launch `sessionId` fetched from the consumer's own backend. Do NOT try to abstract MyID's server-side auth.
- **Credential-leak gotcha:** do NOT put Maven creds in `expo-build-properties` `extraMavenRepos.credentials` for a shipped build — they get baked **cleartext into the APK/AAB** (expo/expo#36778). The release repo is public anyway, so no creds needed.

**⚠️ To verify against live docs before finalizing the API:** exact latest 3.1.x coordinates, whether the 3.1.x flow changed the config/session API shape vs the old `startMyId`, whether a `packagingOptions { pickFirst }` is needed, and whether microphone permission is required. Public sample READMEs top out at 2.3.7; confirm 3.1.x against the current partner README / `docs.myid.uz` (JS-rendered SPA — may need a browser, not plain fetch).

---

## 7. Build plan (ordered — do these next)

1. **Verify current SDK surface** (§6) against live MyID docs. Pin exact 3.1.x coordinates + confirm the 3.1.x config/session flow.
2. **Scaffold** with `create-expo-module` (Expo Modules API — gives config plugin natively AND works in bare RN). Package name `@softwhere-uz/react-native-myid`.
3. **Implement the config plugin.** Delegate mechanical parts to `expo-build-properties`; keep a thin custom plugin for the two things it can't express:
   - `withAppBuildGradle` → the Android `implementation "uz.myid.sdk.capture:..."` dependency line (expo-build-properties can't add a dependency).
   - `withInfoPlist` → `NSCameraUsageDescription` (+ mic), and `ios.privacyManifests` entries.
   - Via expo-build-properties: `android.extraMavenRepos`, `ios.useFrameworks: 'static'`, `ios.extraPods: [{ name: 'MyIdSDK', version: '~> 3.1.3' }]`, `ios.deploymentTarget`.
   - Ship a Podfile `post_install` escape hatch for the static-frameworks/Firebase conflict.
   - Plugin props: `cameraPermission`, `androidSdkVersion`, `iosSdkVersion`, `huawei` (swap to `-bundled`).
   - Make all gradle/plist mods **idempotent** (guard on `contents.includes(...)`) so repeated prebuilds don't duplicate.
4. **Native module surface.** Port the author's proven bridge logic into the Expo Swift/Kotlin DSL. Replace raw `startMyId(6 string args)` + event-emitter with a typed **`identify(config: MyIdConfig): Promise<MyIdResult>`**, discriminated `MyIdError` union, appearance/locale options. Ship full `.d.ts`.
5. **Example app** (`example/`) that reads `clientHash`/`clientHashId`/`sessionId` from **env** (never commit secrets) + a mock/dev mode. Validate an end-to-end run against a real MyID sandbox contract if available.
6. **README** (see §8): bold "unofficial / not affiliated with MyID / UZINFOCOM" disclaimer, the provenance story (link the GitLab Swift header), MIT-on-glue + proprietary-SDK NOTICE, the "managed = dev build, not Expo Go" section, and clear "you need a MyID partnership + credentials" setup docs.
7. **Localization:** `README.md` (English primary) + `README.ru.md` + `README.uz.md`, with a language switcher line at the top:
   `[English](README.md) · [Русский](README.ru.md) · [O'zbekcha](README.uz.md)`.
   **The author (native speaker) writes/polishes the `.ru.md` and `.uz.md`** so they read native — Claude should scaffold the files + write English, then provide a section-for-section English skeleton to translate against.
8. **package.json polish:** MIT license, keywords `["react-native","expo","expo-config-plugin","myid","kyc","biometric","liveness","ios","android"]`, description like: `MyID biometric eKYC for React Native & Expo — New Architecture, config plugin, maintained.` Add repo to https://reactnative.directory metadata.
9. **Publish** to npm under the scope, then differentiate on **maintenance** — keep pace with MyID 3.x releases + a versioned changelog.

---

## 8. Locked decisions

| Decision | Value | Why |
|---|---|---|
| npm name | `@softwhere-uz/react-native-myid` | `react-native-` prefix works for bare RN **and** Expo; scope differentiates (unscoped name is taken); Expo support advertised via keywords/README, not the name |
| Don't over-brand | descriptive name, not invented | it's an SDK wrapper — findable > clever, in a search-driven niche |
| Foundation | Expo Module + config plugin | best DX for a Swift/Kotlin wrapper; native config-plugin; runs in bare RN too |
| Architecture target | New Architecture (Fabric/TurboModule) | default since RN 0.76; legacy frozen |
| Binary handling | reference, never bundle | licensing (§3) |
| License | MIT on glue + NOTICE re: proprietary SDK | §3 |
| Localization | EN primary + RU + UZ secondary READMEs | regional lib; no competitor does it; author writes native copy |
| SDK versions | Android 3.1.9, iOS `~> 3.1.3` | current, not stale 2.x — **re-verify §6** |

---

## 9. Key sources (verified)

- Provenance: `https://gitlab.myid.uz/myid-public-code/myid-rn-sdk/-/raw/main/ios/MyIdModule.swift`
- MyID products (no official RN/Flutter listed): `https://myid.uz/en/produkty/`
- iOS Commercial license: CocoaPods `MyIdSDK` podspec (`trunk.cocoapods.org/api/v1/pods/MyIdSDK`)
- Android Maven + coordinates: `https://artifactory.aigroup.uz/artifactory/myid/uz/myid/sdk/capture/myid-capture-sdk/maven-metadata.xml`
- Integration reference (older 2.x): `https://medium.com/@abdurakhmonziyodov/how-to-integrate-myid-sdk-into-react-native-via-custom-native-modules-ef3736b1f9d6`
- Existing Expo module to study/beat: `https://unpkg.com/expo-myid@0.1.81/plugin/build/index.js`
- Expo config-plugin + build-properties docs: `https://docs.expo.dev/modules/overview/`, `https://docs.expo.dev/versions/latest/sdk/build-properties/`
- Static-frameworks + privacy manifest gotcha: Expo "apple-privacy" guide; credential leak `https://github.com/expo/expo/issues/36778`

---

## 10. Ready-to-paste prompt for the next session

> I'm continuing work on `@softwhere-uz/react-native-myid` — a React Native + Expo library wrapping Uzbekistan's MyID biometric eKYC SDK. Read `HANDOVER.md` in this repo for full context, verified research, and locked decisions. Start with §7 step 1 (verify current MyID 3.1.x SDK coordinates + config/session API against live docs via the Expo/web tools), then scaffold with `create-expo-module` and implement the config plugin per §4 and §7. Respect the licensing rules in §3 (never bundle the binary). Ask me before publishing.
