// @vitest-environment jsdom
// bug-004 — the component tests' async queries wait 10 s, not Testing Library's 1 s default.
import { getConfig } from '@testing-library/react';
import { expect, it } from 'vitest';

it('waits up to 10 s in findBy…/waitFor', () => {
  expect(getConfig().asyncUtilTimeout).toBe(10_000);
});
