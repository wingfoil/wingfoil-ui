// adr-002 authentication port, spec-004 §2 — the per-start token and the sessions derived from it.
import { describe, expect, it } from 'vitest';
import { createTokenAuthentication, MAX_SESSIONS } from '../../../server/src/auth/authentication.js';

const TOKEN = 'A'.repeat(43);

describe('createTokenAuthentication', () => {
  it('accepts the start token only', () => {
    const auth = createTokenAuthentication(TOKEN);
    expect(auth.verifyToken(TOKEN)).toBe(true);
    for (const wrong of ['', 'A'.repeat(42), 'A'.repeat(44), 'B'.repeat(43), `${TOKEN} `]) {
      expect(auth.verifyToken(wrong), JSON.stringify(wrong)).toBe(false);
    }
  });

  it('opens random sessions that it then recognises, and no other', () => {
    const auth = createTokenAuthentication(TOKEN);
    const a = auth.openSession();
    const b = auth.openSession();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).not.toBe(a);
    expect(a).not.toBe(TOKEN);
    expect(auth.verifySession(a)).toBe(true);
    expect(auth.verifySession(b)).toBe(true);
    expect(auth.verifySession(TOKEN)).toBe(false);
    expect(auth.verifySession('')).toBe(false);
    expect(auth.verifySession(`${a}x`)).toBe(false);
  });

  it("does not accept another start's token or sessions (X-02.2)", () => {
    const first = createTokenAuthentication(TOKEN);
    const session = first.openSession();
    const second = createTokenAuthentication('C'.repeat(43));
    expect(second.verifyToken(TOKEN)).toBe(false);
    expect(second.verifySession(session)).toBe(false);
  });

  it('keeps at most 64 sessions, evicting the oldest', () => {
    const auth = createTokenAuthentication(TOKEN);
    const ids = Array.from({ length: 65 }, () => auth.openSession());
    expect(auth.verifySession(ids[0]!)).toBe(false);
    for (const id of ids.slice(1)) expect(auth.verifySession(id)).toBe(true);
    expect(MAX_SESSIONS).toBe(64);
  });

  it('refuses an empty start token', () => {
    expect(() => createTokenAuthentication('')).toThrow();
  });
});
