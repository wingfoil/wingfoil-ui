// @vitest-environment jsdom
// spec-008 §6 at component level (X-09.1 closes on every screen in task-021): with the key catalogue
// every visible text of the start page and its dialog is a catalogue key.
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, stubApi } from '../shell/render.js';

const keys = keyCatalogue(en);
const KEY = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+( \{[^}]+\}| \S+)*$/;

/** Visible text nodes and accessible-name attributes of the document. */
function texts(): string[] {
  const out: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim();
    if (t && !n.parentElement?.closest('[aria-hidden="true"], script, style')) out.push(t);
  }
  for (const el of document.querySelectorAll('[aria-label], [title], [alt], [placeholder]')) {
    for (const a of ['aria-label', 'title', 'alt', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v) out.push(v);
    }
  }
  return out;
}

beforeEach(() => {
  resetSession();
  vi.stubGlobal(
    'EventSource',
    class {
      addEventListener(): void {}
      close(): void {}
    },
  );
});
afterEach(() => {
  cleanup();
  stopEventStream();
  vi.unstubAllGlobals();
});

it('renders only keys on the start page, its warnings and the Add project dialog', async () => {
  stubApi({
    '/api/server': serverInfo([{ key: 'state.corruptKept', args: { file: 'state.json.corrupt-x' } }]),
  });
  const user = userEvent.setup();
  renderApp('/', keys);
  await screen.findByRole('heading', { level: 1, name: 'projects.start.title' });
  await screen.findByText('state.corruptKept state.json.corrupt-x');
  await user.click(screen.getByRole('button', { name: 'projects.start.add' }));
  await screen.findByRole('dialog', { name: 'projects.add.title' });
  const offending = texts().filter((t) => !KEY.test(t));
  expect(offending).toEqual([]);
  expect(document.title).toBe('title.projects');
});
