/**
 * Secret scan of REQ-SEC-09: files (the local state directory, `ui.yaml`, saved logs) must hold no
 * session token, no git credential and no environment variable value. Known secret values (the
 * printed token, a planted environment value) are searched literally; credentials are searched by
 * pattern.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/** One thing found by {@link scanForSecrets}. */
export interface SecretFinding {
  /** File (or label of a text) where it was found. */
  where: string;
  /** What matched: the name of the pattern or `value`. */
  what: string;
}

/** Credential shapes searched in every file. */
export const SECRET_PATTERNS: Readonly<Record<string, RegExp>> = {
  'url-userinfo': /\b[a-z][a-z0-9+.-]*:\/\/[^/\s"'@]+@/i,
  'bearer-header': /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/,
  'github-token': /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/,
  'gitlab-token': /\bglpat-[A-Za-z0-9_-]{20,}/,
  'aws-key': /\bAKIA[0-9A-Z]{16}\b/,
  'session-cookie': /\bwfui_session_\d+=/,
};

async function filesUnder(target: string): Promise<string[]> {
  const info = await stat(target).catch(() => undefined);
  if (!info) return [];
  if (!info.isDirectory()) return [target];
  const entries = await readdir(target);
  const nested = await Promise.all(entries.map((e) => filesUnder(path.join(target, e))));
  return nested.flat();
}

/** Scan a text for the known `values` and the credential patterns. */
export function scanText(where: string, text: string, values: readonly string[] = []): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const value of values) if (value !== '' && text.includes(value)) findings.push({ where, what: 'value' });
  for (const [name, pattern] of Object.entries(SECRET_PATTERNS))
    if (pattern.test(text)) findings.push({ where, what: name });
  return findings;
}

/** Scan every file under `targets` (files or directories; missing ones are skipped). */
export async function scanForSecrets(
  targets: readonly string[],
  values: readonly string[] = [],
): Promise<SecretFinding[]> {
  const files = (await Promise.all(targets.map(filesUnder))).flat();
  const findings = await Promise.all(files.map(async (f) => scanText(f, await readFile(f, 'utf8'), values)));
  return findings.flat();
}
