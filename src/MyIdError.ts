import type { MyIdErrorKind } from './MyId.types';

export interface MyIdErrorOptions {
  /** Raw numeric code from the MyID SDK, when present. */
  code?: number;
  /** Raw message from the MyID SDK, when present. */
  nativeMessage?: string;
  /** Underlying error, when this wraps one. */
  cause?: unknown;
}

/**
 * The single error type {@link identify} rejects with. Inspect `kind` to branch;
 * a user-cancel is `kind: 'cancelled'` (not a crash), so handle it explicitly.
 */
export class MyIdError extends Error {
  /** Discriminated failure category. */
  readonly kind: MyIdErrorKind;
  /** Raw numeric code from the MyID SDK, when present. */
  readonly code?: number;
  /** Raw message from the MyID SDK, when present. */
  readonly nativeMessage?: string;

  constructor(kind: MyIdErrorKind, message: string, options: MyIdErrorOptions = {}) {
    super(message);
    this.name = 'MyIdError';
    this.kind = kind;
    this.code = options.code;
    this.nativeMessage = options.nativeMessage;
    if (options.cause !== undefined) {
      // `cause` is standard on Error but typed loosely across runtimes.
      (this as { cause?: unknown }).cause = options.cause;
    }
    // Restore the prototype chain (transpilation to ES5 breaks `instanceof`).
    Object.setPrototypeOf(this, MyIdError.prototype);
  }
}

/**
 * Type guard for {@link MyIdError}. Robust across module/realm boundaries: it
 * accepts both real instances and error-shaped objects carrying `name` +
 * `kind` (e.g. after serialization across the native bridge).
 */
export function isMyIdError(value: unknown): value is MyIdError {
  if (value instanceof MyIdError) {
    return true;
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { name?: unknown }).name === 'MyIdError' &&
    typeof (value as { kind?: unknown }).kind === 'string'
  );
}
