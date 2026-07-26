import { getNativeMyIdModule } from '../MyIdModule';
import { identify, isMyIdError, MyIdError } from '../index';
import type { MyIdConfig } from '../index';

// Mock the native bridge with a factory (so the real module — which imports
// `expo` — never loads) to drive `identify()`'s native path: defaults, outcome
// mapping, error translation, all without a device.
jest.mock('../MyIdModule', () => ({ getNativeMyIdModule: jest.fn() }));

const mockedGetNative = getNativeMyIdModule as jest.MockedFunction<typeof getNativeMyIdModule>;
const nativeIdentify = jest.fn();

const validConfig: MyIdConfig = {
  sessionId: 'sess-12345678',
  clientHash: 'client-hash',
  clientHashId: 'client-hash-id',
};

beforeEach(() => {
  nativeIdentify.mockReset();
  mockedGetNative.mockReturnValue({ identify: nativeIdentify } as never);
});

it('resolves a success outcome and applies environment/entryType defaults', async () => {
  nativeIdentify.mockResolvedValue({
    status: 'success',
    code: 'OK',
    base64Image: 'AAA',
    comparison: 0.9,
  });
  const result = await identify(validConfig);
  expect(result).toEqual({ code: 'OK', base64Image: 'AAA', comparison: 0.9 });
  expect(nativeIdentify).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionId: 'sess-12345678',
      environment: 'PRODUCTION',
      entryType: 'IDENTIFICATION',
    })
  );
});

it('does not override explicitly provided environment/entryType', async () => {
  nativeIdentify.mockResolvedValue({ status: 'success', code: 'OK' });
  await identify({ ...validConfig, environment: 'SANDBOX', entryType: 'FACE_DETECTION' });
  expect(nativeIdentify).toHaveBeenCalledWith(
    expect.objectContaining({ environment: 'SANDBOX', entryType: 'FACE_DETECTION' })
  );
});

it('normalizes null image/comparison to undefined', async () => {
  nativeIdentify.mockResolvedValue({
    status: 'success',
    code: 'OK',
    base64Image: null,
    comparison: null,
  });
  const result = await identify(validConfig);
  expect(result).toEqual({ code: 'OK', base64Image: undefined, comparison: undefined });
});

it('maps a cancelled outcome to kind "cancelled"', async () => {
  nativeIdentify.mockResolvedValue({ status: 'cancelled' });
  await expect(identify(validConfig)).rejects.toMatchObject({ kind: 'cancelled' });
});

it('maps an error outcome to a typed MyIdError with code + nativeMessage', async () => {
  nativeIdentify.mockResolvedValue({
    status: 'error',
    kind: 'sdk',
    code: 122,
    message: 'user banned',
  });
  const error = await identify(validConfig).catch((e) => e);
  expect(isMyIdError(error)).toBe(true);
  expect(error).toMatchObject({ kind: 'sdk', code: 122, nativeMessage: 'user banned' });
});

it('translates an unexpected native throw to kind "unknown"', async () => {
  nativeIdentify.mockRejectedValue(new Error('boom'));
  const error = await identify(validConfig).catch((e) => e);
  expect(isMyIdError(error)).toBe(true);
  expect(error.kind).toBe('unknown');
});

it('skips native entirely for invalid config', async () => {
  await expect(identify({ ...validConfig, sessionId: '' })).rejects.toMatchObject({
    kind: 'config',
  });
  expect(nativeIdentify).not.toHaveBeenCalled();
});

it('re-throws a MyIdError raised by the native side unchanged', async () => {
  const original = new MyIdError('permission', 'camera denied');
  nativeIdentify.mockRejectedValue(original);
  await expect(identify(validConfig)).rejects.toBe(original);
});

it('re-throws an error-shaped object from the bridge without re-wrapping it', async () => {
  // Across the native bridge a MyIdError may arrive as a plain, duck-typed
  // object (name + kind) rather than a real instance. identify() must recognize
  // it via isMyIdError and re-throw it as-is — NOT re-wrap it as kind "unknown".
  const serialized = { name: 'MyIdError', kind: 'sdk', code: 122, message: 'user banned' };
  nativeIdentify.mockRejectedValue(serialized);
  const error = await identify(validConfig).catch((e) => e);
  expect(isMyIdError(error)).toBe(true);
  expect(error).toBe(serialized);
  expect(error.kind).toBe('sdk');
  expect(error.code).toBe(122);
});

it('passes every optional config field through to native intact', async () => {
  // validateAndNormalize spreads the whole config; a dropped/mangled optional
  // field would still keep line coverage green, so pin the passthrough here.
  const fullConfig: MyIdConfig = {
    ...validConfig,
    environment: 'SANDBOX',
    entryType: 'FACE_DETECTION',
    locale: 'RU',
    residency: 'NON_RESIDENT',
    cameraShape: 'ELLIPSE',
    cameraSelector: 'BACK',
    minAge: 18,
    distance: 0.75,
    showErrorScreen: false,
    organizationDetails: { phoneNumber: '+998900000000', logo: 'data:image/png;base64,AAAA' },
    appearance: {
      colorPrimary: '#0A84FF',
      colorOnPrimary: '#FFFFFF',
      colorError: '#FF0000',
      colorSuccess: '#00FF00',
      buttonCornerRadius: 12,
    },
    huaweiAppId: 'hms-123',
  };
  nativeIdentify.mockResolvedValue({ status: 'success', code: 'OK' });
  await identify(fullConfig);
  // Exact match: any dropped, added, or mangled field fails this assertion.
  expect(nativeIdentify).toHaveBeenCalledWith(fullConfig);
});

it('falls back to a generic message for an error outcome with no message', async () => {
  nativeIdentify.mockResolvedValue({ status: 'error', kind: 'network' });
  const error = await identify(validConfig).catch((e) => e);
  expect(error).toBeInstanceOf(MyIdError);
  expect(error.kind).toBe('network');
  expect(error.message).toBe('MyID failed (network).');
});

it('uses a thrown string as the message when native throws a string', async () => {
  nativeIdentify.mockRejectedValue('kaboom');
  const error = await identify(validConfig).catch((e) => e);
  expect(error.kind).toBe('unknown');
  expect(error.message).toBe('kaboom');
  expect(error.nativeMessage).toBe('kaboom');
});

it('uses a generic message when native throws a message-less value', async () => {
  nativeIdentify.mockRejectedValue({ notAMessage: true });
  const error = await identify(validConfig).catch((e) => e);
  expect(error.kind).toBe('unknown');
  expect(error.message).toBe('MyID failed unexpectedly.');
});

it('uses a generic message when native throws null', async () => {
  nativeIdentify.mockRejectedValue(null);
  const error = await identify(validConfig).catch((e) => e);
  expect(error.kind).toBe('unknown');
  expect(error.message).toBe('MyID failed unexpectedly.');
});

it('guards against an unrecognized native outcome status', async () => {
  nativeIdentify.mockResolvedValue({ status: 'bogus' } as never);
  const error = await identify(validConfig).catch((e) => e);
  expect(error.kind).toBe('unknown');
  expect(error.message).toMatch(/Unrecognized MyID outcome/);
});
