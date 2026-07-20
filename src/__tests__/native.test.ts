import { getNativeMyIdModule } from '../MyIdModule';
import { identify, isMyIdError } from '../index';
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
