// @ts-check
// `npm run i18n:check -w web` (and the end of `npm run lint`): the spec-008 §6 catalogue check.
import { checkCatalogue } from './catalogue.mjs';

const problems = await checkCatalogue();
for (const p of problems) console.error(`spec-008: ${p}`);
if (problems.length > 0) process.exitCode = 1;
