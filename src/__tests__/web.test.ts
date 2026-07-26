import { isMyIdError, MyIdError } from '../MyIdError';
// Import the web variant directly (Metro resolves `MyIdModule.web` on web; here
// we test that variant explicitly). It only pulls in MyIdError — never
// expo-modules-core — so it is safe to load in a plain Node/jest environment.
import { getNativeMyIdModule } from '../MyIdModule.web';

describe('MyIdModule.web', () => {
  it('throws a typed MyIdError explaining MyID is unavailable on web', () => {
    expect(() => getNativeMyIdModule()).toThrow(MyIdError);
    expect(() => getNativeMyIdModule()).toThrow(/not available on web/i);
  });

  it('tags the web error with kind "unknown"', () => {
    let caught: unknown;
    try {
      getNativeMyIdModule();
    } catch (error) {
      caught = error;
    }
    expect(isMyIdError(caught)).toBe(true);
    expect((caught as MyIdError).kind).toBe('unknown');
  });
});
