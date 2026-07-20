// Public type surface for @softwhere-uz/react-native-myid.
//
// Modeled on the verified MyID 3.1.x *session* flow (iOS MyIdSDK 3.1.3 /
// Android myid-capture-sdk 3.1.9). The legacy 2.x `clientId` + `passportData`
// flow was removed by the SDK — see docs/DECISIONS.md.

/** Which MyID backend the session runs against. Defaults to `PRODUCTION`. */
export type MyIdEnvironment = 'SANDBOX' | 'PRODUCTION';

/**
 * The kind of capture flow to run. Defaults to `IDENTIFICATION`.
 * `VIDEO_IDENTIFICATION` requires the extra `myid-video-capture-sdk` on Android.
 */
export type MyIdEntryType = 'IDENTIFICATION' | 'FACE_DETECTION' | 'VIDEO_IDENTIFICATION';

/** UI language of the MyID flow. */
export type MyIdLocale = 'UZ' | 'RU' | 'EN';

/** Residency hint passed to MyID. */
export type MyIdResidency = 'RESIDENT' | 'NON_RESIDENT' | 'USER_DEFINED';

/** Shape of the face-capture cutout. */
export type MyIdCameraShape = 'CIRCLE' | 'ELLIPSE';

/** Which camera to open. Face liveness normally uses `FRONT`. */
export type MyIdCameraSelector = 'FRONT' | 'BACK';

/**
 * Optional look-and-feel overrides. Colors are hex strings (e.g. `#0A84FF`).
 *
 * Parity note: on iOS these map to `MyIdAppearance` (applied programmatically);
 * on Android theming is primarily XML-resource based, so some fields may be
 * ignored there. Colors that both platforms honor are the safest to set.
 */
export interface MyIdAppearance {
  colorPrimary?: string;
  colorOnPrimary?: string;
  colorError?: string;
  colorSuccess?: string;
  /** Corner radius (points/dp) for primary buttons. */
  buttonCornerRadius?: number;
}

/** Optional organization details shown inside the MyID flow. */
export interface MyIdOrganizationDetails {
  phoneNumber?: string;
  /** A base64-encoded image or a remote URL, per your MyID setup. */
  logo?: string;
}

/**
 * Configuration for a single {@link identify} call.
 *
 * The three required fields come from your MyID partnership: `clientHash` and
 * `clientHashId` are issued by MyID sales; `sessionId` is minted per-launch by
 * YOUR backend from MyID's session API. The library cannot remove that gate.
 */
export interface MyIdConfig {
  /** Per-launch session id minted server-side by your backend. Required. */
  sessionId: string;
  /** Client hash issued by MyID. Required. */
  clientHash: string;
  /** Client hash id issued by MyID. Required. */
  clientHashId: string;

  /** Backend environment. Default `PRODUCTION`. */
  environment?: MyIdEnvironment;
  /** Capture flow. Default `IDENTIFICATION`. */
  entryType?: MyIdEntryType;
  /** UI language. */
  locale?: MyIdLocale;
  /** Residency hint. */
  residency?: MyIdResidency;
  /** Camera cutout shape. */
  cameraShape?: MyIdCameraShape;
  /** Which camera to open. */
  cameraSelector?: MyIdCameraSelector;
  /** Minimum age gate. */
  minAge?: number;
  /** Face distance threshold (SDK-specific units). */
  distance?: number;
  /** Whether the SDK shows its own error screen. */
  showErrorScreen?: boolean;
  /** Organization details shown in the flow. */
  organizationDetails?: MyIdOrganizationDetails;
  /** Look-and-feel overrides. */
  appearance?: MyIdAppearance;
  /**
   * Huawei AppGallery id — Android only, required for HMS (no-Google-Play)
   * devices. Ignored on iOS.
   */
  huaweiAppId?: string;
}

/**
 * The result of a successful {@link identify}.
 *
 * `code` is an identification handle — **verify it against MyID from your own
 * backend**; never trust the client result alone.
 */
export interface MyIdResult {
  /** Identification result code to verify server-side. */
  code: string;
  /**
   * Captured face portrait as a base64 PNG (no data-URI prefix), when the SDK
   * returns one. Normalized to PNG on both platforms.
   */
  base64Image?: string;
  /** Face-match score, when the SDK provides it (absent on iOS 3.1.3). */
  comparison?: number;
}

/**
 * Discriminated failure category for {@link MyIdError.kind}.
 *
 * - `cancelled`   — the user exited the flow (not an error condition).
 * - `permission`  — camera permission denied.
 * - `network`     — connectivity/backend transport failure.
 * - `sdk`         — the MyID SDK reported an error (see `code`).
 * - `no_activity` — Android had no current Activity to launch into.
 * - `config`      — invalid {@link MyIdConfig} passed by the caller.
 * - `unknown`     — anything else.
 */
export type MyIdErrorKind =
  'cancelled' | 'permission' | 'network' | 'sdk' | 'no_activity' | 'config' | 'unknown';
