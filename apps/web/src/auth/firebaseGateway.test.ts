import { describe, expect, it } from 'vitest';
import { toSignInError } from './firebaseGateway';
import { SignInError } from './gateway';

describe('toSignInError', () => {
  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])(
    '%s se normaliza como cancelado',
    (code) => {
      const error = toSignInError({ code, message: 'Firebase: Error' });
      expect(error).toBeInstanceOf(SignInError);
      expect(error.reason).toBe('cancelado');
      expect(error.code).toBe(code);
    },
  );

  it.each([
    [{ code: 'auth/popup-blocked' }, 'auth/popup-blocked'],
    [{ code: 'auth/network-request-failed' }, 'auth/network-request-failed'],
    [new Error('sin código'), undefined],
    ['texto', undefined],
  ])('%o se normaliza como fallido', (input, code) => {
    const error = toSignInError(input);
    expect(error.reason).toBe('fallido');
    expect(error.code).toBe(code);
  });
});
