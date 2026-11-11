// @vitest-environment jsdom
// task-070 AC-2 (spec-004 §5; the approver's Q3-a of task-056, D70-8): the refusal toast shows a
// WingFoil 0.3.x refusal's `detail.reasons[]` in its verbatim block, after the CLI's message, one
// line per reason — tool text is data (X-09.1): no catalogue string, no reason in the catalogue
// arguments. A refusal without reasons (WingFoil 0.2.2) is shown as before.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../web/src/api/client.js';
import { errorMessage } from '../../../web/src/api/error-message.js';
import type { ElementWriteVariables } from '../../../web/src/api/writes.js';
import { writeRefusalToast } from '../../../web/src/element/write-toast.js';
import { AppIntlProvider } from '../../../web/src/i18n/index.js';

afterEach(() => cleanup());

const MESSAGE = "illegal transition pending -> (none) for type 'task'";
const GATE = 'illegal `submit` from "pending": a `gates` state — its forward edge requires `approve`, not `submit`';
const VARS: ElementWriteVariables = {
  pid: 'p_0000000000000',
  eid: 'task-001-login-form',
  verb: 'submit',
  expectedStatus: 'pending',
};

function renderToast(error: ApiError) {
  const toast = writeRefusalToast(VARS, error);
  return render(
    <AppIntlProvider>
      <div role="alert">
        {toast.title}
        {toast.body}
      </div>
    </AppIntlProvider>,
  );
}

describe('the refusal toast and detail.reasons', () => {
  it('shows the CLI message then one line per reason in the verbatim block, after the catalogue line', () => {
    const { container } = renderToast(
      new ApiError(422, 'cli-refused', MESSAGE, { reasons: [GATE, 'see \\u202e <project>/docs/x.md'] }),
    );
    expect(container.textContent).toContain('Submit of task-001-login-form not done');
    const paragraphs = [...container.querySelectorAll('p')].map((p) => p.textContent);
    expect(paragraphs).toEqual(['WingFoil refused the action:']);
    const pre = container.querySelectorAll('pre.verbatim');
    expect(pre).toHaveLength(1);
    expect(pre[0]!.textContent).toBe(`${MESSAGE}\n${GATE}\nsee \\u202e <project>/docs/x.md`);
    // The verbatim block follows the catalogue line.
    expect(
      container.querySelector('p')!.compareDocumentPosition(pre[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('a refusal without detail (WingFoil 0.2.2) shows the message alone', () => {
    const { container } = renderToast(new ApiError(422, 'cli-refused', MESSAGE, undefined));
    expect(container.querySelector('pre.verbatim')!.textContent).toBe(MESSAGE);
  });

  it.each([
    ['reasons not a list', { reasons: GATE }],
    ['reasons with a non-text item', { reasons: [GATE, 3] }],
    ['an empty list', { reasons: [] }],
  ])('%s: the message alone', (_l, detail) => {
    const { container } = renderToast(new ApiError(422, 'cli-refused', MESSAGE, detail));
    expect(container.querySelector('pre.verbatim')!.textContent).toBe(MESSAGE);
  });

  it('reasons are not a catalogue argument, and only cli-refused shows them', () => {
    const rendering = errorMessage({ code: 'cli-refused', message: MESSAGE, detail: { reasons: [GATE] } });
    expect(rendering.values).toEqual({});
    expect(rendering.verbatim).toBe(`${MESSAGE}\n${GATE}`);
    const git = errorMessage({ code: 'git-refused', message: 'fatal', detail: { reasons: [GATE] } });
    expect(git.verbatim).toBe('fatal');
  });
});
