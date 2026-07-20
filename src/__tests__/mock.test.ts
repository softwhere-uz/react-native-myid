import { identify, setMockMode, isMockModeEnabled, isMyIdError, MyIdError } from '../index';
import type { MyIdConfig, MyIdMockOutcome } from '../index';

// Never load the real native bridge (which imports `expo`) — these tests only
// exercise validation + mock mode, which never touch native.
jest.mock('../MyIdModule', () => ({ getNativeMyIdModule: jest.fn() }));

const validConfig: MyIdConfig = {
  sessionId: 'sess-abcdefgh',
  clientHash: 'client-hash',
  clientHashId: 'client-hash-id',
};

afterEach(() => setMockMode(null));

describe('validation', () => {
  it('rejects a missing config with kind "config" and never enables mock', async () => {
    // @ts-expect-error intentionally invalid
    await expect(identify(undefined)).rejects.toMatchObject({ kind: 'config' });
  });

  it.each(['sessionId', 'clientHash', 'clientHashId'] as const)(
    'rejects an empty %s with kind "config"',
    async (field) => {
      const bad = { ...validConfig, [field]: '   ' };
      const error = await identify(bad).catch((e) => e);
      expect(isMyIdError(error)).toBe(true);
      expect(error.kind).toBe('config');
    }
  );
});

describe('mock mode', () => {
  it('reports whether mock mode is enabled', () => {
    expect(isMockModeEnabled()).toBe(false);
    setMockMode({ outcome: 'success', delayMs: 0 });
    expect(isMockModeEnabled()).toBe(true);
  });

  it('resolves a well-formed MyIdResult on success', async () => {
    setMockMode({ outcome: 'success', delayMs: 0 });
    const result = await identify(validConfig);
    expect(typeof result.code).toBe('string');
    expect(typeof result.base64Image).toBe('string');
    expect(result.comparison).toBeGreaterThan(0);
  });

  it('honors success result overrides', async () => {
    setMockMode({ outcome: 'success', delayMs: 0, result: { code: 'CUSTOM', comparison: 0.42 } });
    const result = await identify(validConfig);
    expect(result.code).toBe('CUSTOM');
    expect(result.comparison).toBe(0.42);
  });

  const failureOutcomes: MyIdMockOutcome[] = [
    'cancelled',
    'permission',
    'network',
    'sdk',
    'no_activity',
    'unknown',
  ];

  it.each(failureOutcomes)('rejects with a typed MyIdError for "%s"', async (outcome) => {
    setMockMode({ outcome, delayMs: 0 });
    const error = await identify(validConfig).catch((e) => e);
    expect(isMyIdError(error)).toBe(true);
    expect(error.kind).toBe(outcome);
  });

  it('attaches a default numeric code for an "sdk" failure', async () => {
    setMockMode({ outcome: 'sdk', delayMs: 0 });
    const error = (await identify(validConfig).catch((e) => e)) as MyIdError;
    expect(error.code).toBe(103);
  });
});

describe('isMyIdError', () => {
  it('recognizes real instances and error-shaped objects, rejects others', () => {
    expect(isMyIdError(new MyIdError('unknown', 'x'))).toBe(true);
    expect(isMyIdError({ name: 'MyIdError', kind: 'sdk' })).toBe(true);
    expect(isMyIdError(new Error('plain'))).toBe(false);
    expect(isMyIdError(null)).toBe(false);
    expect(isMyIdError('nope')).toBe(false);
  });
});
