// spec-009 §5: no hex, rgb() or hsl() colour literal in web/src outside the tokens file —
// components use the semantic tokens only.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { REPO_ROOT } from '../../harness/cli.js';

const SRC = path.join(REPO_ROOT, 'web', 'src');
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\s*\(/;

/** Colour literals of one source text (comments included: a literal is a literal). */
function colourLiterals(text: string): string[] {
  return text.split('\n').flatMap((line, i) => (COLOUR.test(line) ? [`${i + 1}: ${line.trim()}`] : []));
}

it('finds a planted literal', () => {
  expect(colourLiterals('a { color: #fff; }\nb { color: rgb(0 0 0); }\nc { color: var(--color-text); }')).toHaveLength(
    2,
  );
});

it('finds no colour literal in web/src outside theme/tokens.css', () => {
  const found: string[] = [];
  for (const e of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!e.isFile() || !/\.(ts|tsx|css|html)$/.test(e.name)) continue;
    const file = path.join(e.parentPath, e.name);
    if (path.relative(SRC, file) === path.join('theme', 'tokens.css')) continue;
    for (const l of colourLiterals(readFileSync(file, 'utf8'))) found.push(`${path.relative(SRC, file)}:${l}`);
  }
  expect(found).toEqual([]);
});
