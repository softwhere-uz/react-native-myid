import { MyIdError } from './MyIdError';
import type { MyIdNativeModule } from './MyIdModule';

// MyID has custom native code and cannot run on web. This variant is resolved
// on web in place of MyIdModule.ts; any call fails fast with a clear error.
export function getNativeMyIdModule(): MyIdNativeModule {
  throw new MyIdError(
    'unknown',
    'MyID is not available on web. It requires a native iOS/Android build (a dev/EAS build — never Expo Go).'
  );
}
