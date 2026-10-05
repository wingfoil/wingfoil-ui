/**
 * Opaque project ids (spec-006 §2, REQ-SEC-04): `p_` + 12 characters of lower-case Crockford
 * base32 from 60 random bits, drawn at add time and never derived from the path.
 */
import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/** The form of every project id. */
export const PROJECT_ID_PATTERN = /^p_[0-9abcdefghjkmnpqrstvwxyz]{12}$/;

/** Source of random bytes (injected by tests). */
export type RandomSource = (size: number) => Buffer;

/** Draw a new project id from the first 60 bits of 8 random bytes. */
export function newProjectId(random: RandomSource = randomBytes): string {
  let bits = random(8).readBigUInt64BE(0) >> 4n;
  let digits = '';
  for (let i = 0; i < 12; i++) {
    digits = ALPHABET[Number(bits & 31n)]! + digits;
    bits >>= 5n;
  }
  return `p_${digits}`;
}

/** Whether `value` has the form of a project id (it may still be unknown). */
export function isProjectId(value: string): boolean {
  return PROJECT_ID_PATTERN.test(value);
}
