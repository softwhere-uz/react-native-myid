// Exercise the real `getNativeMyIdModule()` bridge resolver (elsewhere it is
// mocked away). We stub `expo-modules-core`'s `requireNativeModule` so the
// lazy-resolve + cache behavior can be asserted without a device build.
// The mock factory is hoisted above imports, so its captured variable must be
// `mock`-prefixed per jest's rules.
const mockRequireNativeModule = jest.fn();
jest.mock('expo-modules-core', () => ({ requireNativeModule: mockRequireNativeModule }));

beforeEach(() => {
  mockRequireNativeModule.mockReset();
});

describe('getNativeMyIdModule', () => {
  it('resolves the native module named "MyId"', () => {
    const fake = { identify: jest.fn() };
    mockRequireNativeModule.mockReturnValue(fake);

    let mod: typeof import('../MyIdModule');
    jest.isolateModules(() => {
      mod = require('../MyIdModule');
    });

    expect(mod!.getNativeMyIdModule()).toBe(fake);
    expect(mockRequireNativeModule).toHaveBeenCalledWith('MyId');
  });

  it('caches the resolved module (binds the bridge only once)', () => {
    mockRequireNativeModule.mockReturnValue({ identify: jest.fn() });

    let mod: typeof import('../MyIdModule');
    jest.isolateModules(() => {
      mod = require('../MyIdModule');
    });

    const first = mod!.getNativeMyIdModule();
    const second = mod!.getNativeMyIdModule();

    expect(first).toBe(second);
    expect(mockRequireNativeModule).toHaveBeenCalledTimes(1);
  });

  it('does not touch the bridge at import time (lazy binding)', () => {
    jest.isolateModules(() => {
      require('../MyIdModule');
    });
    expect(mockRequireNativeModule).not.toHaveBeenCalled();
  });
});
