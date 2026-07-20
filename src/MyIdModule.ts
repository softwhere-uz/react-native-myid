// Imported from `expo-modules-core` (not `expo`) so the library's dev
// dependencies don't pull Metro into node_modules — which conflicts with the
// sibling example app's Metro. `requireNativeModule` is identical either way,
// and expo-modules-core is always present via the consumer's `expo`.
import { requireNativeModule } from 'expo-modules-core';

import type { MyIdConfig, MyIdEntryType, MyIdEnvironment } from './MyId.types';

/**
 * Config after {@link identify} validation + defaults. This is exactly what we
 * hand to the native side, so `environment` and `entryType` are always present.
 */
export interface MyIdResolvedConfig extends MyIdConfig {
  environment: MyIdEnvironment;
  entryType: MyIdEntryType;
}

/**
 * Internal outcome the native `identify()` ALWAYS resolves with — it never
 * rejects for *expected* cases. Resolving (instead of rejecting) lets
 * structured data (numeric code, message, discriminant) survive the bridge
 * intact; the JS wrapper turns non-success outcomes into a rejected
 * {@link MyIdError}.
 */
export type MyIdNativeOutcome =
  | { status: 'success'; code: string; base64Image?: string | null; comparison?: number | null }
  | { status: 'cancelled' }
  | {
      status: 'error';
      kind: 'permission' | 'network' | 'sdk' | 'no_activity' | 'unknown';
      code?: number | null;
      message?: string | null;
    };

export interface MyIdNativeModule {
  identify(config: MyIdResolvedConfig): Promise<MyIdNativeOutcome>;
}

let cached: MyIdNativeModule | null = null;

/**
 * Lazily resolve the native module. Kept lazy (not a top-level
 * `requireNativeModule`) so importing this package never throws in a JS-only
 * environment (unit tests, mock mode, SSR) — it only binds when a real call is
 * made on a device/simulator build.
 */
export function getNativeMyIdModule(): MyIdNativeModule {
  if (cached == null) {
    cached = requireNativeModule<MyIdNativeModule>('MyId');
  }
  return cached;
}
