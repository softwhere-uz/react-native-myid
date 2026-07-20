import type { MyIdConfig, MyIdResult } from './MyId.types';
import { MyIdError, isMyIdError } from './MyIdError';
import { getNativeMyIdModule } from './MyIdModule';
import type { MyIdNativeOutcome, MyIdResolvedConfig } from './MyIdModule';

export * from './MyId.types';
export { MyIdError, isMyIdError } from './MyIdError';
export type { MyIdErrorOptions } from './MyIdError';

// ---------------------------------------------------------------------------
// Mock mode (development / demo / tests only)
// ---------------------------------------------------------------------------

/** Outcome a mock run should simulate: a success or any failure `kind`. */
export type MyIdMockOutcome =
  'success' | 'cancelled' | 'permission' | 'network' | 'sdk' | 'no_activity' | 'unknown';

export interface MyIdMockScenario {
  /** What the mocked {@link identify} should do. */
  outcome: MyIdMockOutcome;
  /** Artificial delay before resolving/rejecting, ms (default 1200). */
  delayMs?: number;
  /** Overrides for the resolved {@link MyIdResult} when `outcome: 'success'`. */
  result?: Partial<MyIdResult>;
  /** Raw numeric SDK code to attach when `outcome: 'sdk'`. */
  code?: number;
  /** Override the error message for a failure outcome. */
  message?: string;
}

// A valid 2x2 PNG (base64, no data-URI prefix) so the demo can render a real
// image for a mocked success without any MyID contract.
const MOCK_FACE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGPgavn/3+R45H8GEAHiAABScwm/EPm/GgAAAABJRU5ErkJggg==';

let mockScenario: MyIdMockScenario | null = null;

/**
 * Enable (or disable, with `null`) a mocked {@link identify}. When set, calls
 * never touch native code — useful for demoing the success/error UI without a
 * MyID contract, and for tests. **Never enable this in production.**
 */
export function setMockMode(scenario: MyIdMockScenario | null): void {
  mockScenario = scenario;
}

/** Whether mock mode is currently active. */
export function isMockModeEnabled(): boolean {
  return mockScenario != null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Launch the MyID face-liveness / identification flow.
 *
 * Resolves with a {@link MyIdResult} on success. Rejects with a
 * {@link MyIdError} otherwise — including a normal user-cancel, which is
 * `kind: 'cancelled'`. Verify `result.code` from your own backend.
 */
export async function identify(config: MyIdConfig): Promise<MyIdResult> {
  const resolved = validateAndNormalize(config);

  if (mockScenario != null) {
    return runMock(resolved, mockScenario);
  }

  let outcome: MyIdNativeOutcome;
  try {
    outcome = await getNativeMyIdModule().identify(resolved);
  } catch (error) {
    // The native side resolves for expected cases, so a throw here is
    // unexpected (e.g. the native module isn't installed, or an internal
    // crash). Surface it as a typed error rather than leaking a raw one.
    if (isMyIdError(error)) {
      throw error;
    }
    const message = errorMessage(error) ?? 'MyID failed unexpectedly.';
    throw new MyIdError('unknown', message, { nativeMessage: message, cause: error });
  }

  return outcomeToResult(outcome);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ['sessionId', 'clientHash', 'clientHashId'] as const;

function validateAndNormalize(config: MyIdConfig): MyIdResolvedConfig {
  if (config == null || typeof config !== 'object') {
    throw new MyIdError('config', 'identify(config) requires a MyIdConfig object.');
  }
  for (const field of REQUIRED_FIELDS) {
    const value = config[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new MyIdError(
        'config',
        `MyIdConfig.${field} is required and must be a non-empty string.`
      );
    }
  }
  return {
    ...config,
    environment: config.environment ?? 'PRODUCTION',
    entryType: config.entryType ?? 'IDENTIFICATION',
  };
}

function outcomeToResult(outcome: MyIdNativeOutcome): MyIdResult {
  switch (outcome.status) {
    case 'success':
      return {
        code: outcome.code,
        base64Image: outcome.base64Image ?? undefined,
        comparison: outcome.comparison ?? undefined,
      };
    case 'cancelled':
      throw new MyIdError('cancelled', 'User exited the MyID flow.');
    case 'error':
      throw new MyIdError(outcome.kind, outcome.message ?? `MyID failed (${outcome.kind}).`, {
        code: outcome.code ?? undefined,
        nativeMessage: outcome.message ?? undefined,
      });
    default: {
      // Exhaustiveness guard — unreachable for a well-behaved native module.
      const unexpected: never = outcome;
      throw new MyIdError('unknown', `Unrecognized MyID outcome: ${JSON.stringify(unexpected)}.`);
    }
  }
}

async function runMock(
  config: MyIdResolvedConfig,
  scenario: MyIdMockScenario
): Promise<MyIdResult> {
  await delay(scenario.delayMs ?? 1200);
  if (scenario.outcome === 'success') {
    return {
      code: scenario.result?.code ?? `MOCK-${config.sessionId.slice(0, 8)}`,
      base64Image: scenario.result?.base64Image ?? MOCK_FACE_PNG_BASE64,
      comparison: scenario.result?.comparison ?? 0.98,
    };
  }
  if (scenario.outcome === 'cancelled') {
    throw new MyIdError('cancelled', scenario.message ?? 'User exited the MyID flow. (mock)');
  }
  throw new MyIdError(scenario.outcome, scenario.message ?? `Mocked ${scenario.outcome} failure.`, {
    code: scenario.outcome === 'sdk' ? (scenario.code ?? 103) : undefined,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function errorMessage(error: unknown): string | undefined {
  if (error == null) {
    return undefined;
  }
  if (typeof error === 'string') {
    return error;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}
