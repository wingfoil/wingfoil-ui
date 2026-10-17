/**
 * The git status at the bottom of the project sidebar (task-039; ux-reference §3 *Git status*;
 * spec-010 §3, §7; decisions D39-1 … D39-13), from the project header (`projectHeaderQuery`), so the
 * `repo` event refreshes it like the header:
 *
 * - the head line (branch and short hash, or "Detached HEAD at <hash>") and the local changes —
 *   always shown;
 * - while `has-remote` holds (spec-010 §7, Y-04, S-11.2): the copy line, *Fetch* with *Cancel*
 *   (RP-37), the last fetch error with the time of the last success and git's message on hover and
 *   on keyboard focus (D39-4), the last update error (D39-6); nothing of it otherwise;
 * - a manual fetch refused before git runs (409: not recorded by the server) shows in an alert of
 *   its own, cleared when the next fetch starts or a later fetch succeeded (D39-5);
 * - while the fetch runs, *Fetch* stays in place, aria-disabled, reading "Fetching…" (D39-13);
 * - *Update* while the copy is behind and *Push* with "N commits to push" while it is only ahead
 *   (task-040, D40-1), read-only for a user who is not one member (D40-3); one transport at a time
 *   per project, whoever started it — the element footer's *Update* link included — every control
 *   aria-disabled meanwhile, the running one reading "Updating…" / "Pushing…", *Cancel* only for a
 *   fetch or a push (RP-37); a control that held the focus and goes with the new state hands it to
 *   *Fetch* (D40-4);
 * - outcomes (D40-5): a success is the new copy line; an update refusal the server records shows as
 *   the last update error, one it does not record (403, 500, unreachable) in the alert; every push
 *   failure is a red toast (`push-toast.tsx`); a cancel shows nothing.
 *
 * Keyed by pid: nothing of one project's running transport or alert reaches another.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, DialogTrigger, Popover, Tooltip, TooltipTrigger } from 'react-aria-components';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import type { ApiError } from '../api/client.js';
import { errorMessage } from '../api/error-message.js';
import { CANCELLED, useGitOperation, useRunningGitOperation } from '../api/git.js';
import { projectHeaderQuery } from '../api/queries.js';
import { ErrorText } from '../shell/ErrorText.js';
import { InfoSign } from '../shell/icons.js';
import { gitStatusView, lastFetched, type CopyLine, type FetchErrorView } from './model.js';
import type { GitOperation, UpdateSyncError } from '@wingfoil-ui/contracts';
import { showToast } from '../shell/toasts.js';
import { pushFailureToast } from './push-toast.js';
import './git-status.css';

/** The git status of project `pid`. */
export function GitStatus({ pid }: { pid: string }): ReactNode {
  return <GitStatusOf key={pid} pid={pid} />;
}

/**
 * A refusal the server does not record — of a manual fetch (D39-5) or update (D40-5) — and the read
 * it was seen against: it clears when a later fetch succeeded, when the repository state moved or
 * when the sync part goes (review R7), and when the next transport starts.
 */
interface Refusal {
  error: ApiError;
  lastSuccessAt: string | null;
  state: string;
}

/** Codes the server records (`sync.fetch.lastError`, `sync.update.lastError`): not the alert. */
const RECORDED = 'git-refused';

/** HTTP status of a transport refusal (spec-010 §5): an update's is recorded by the server. */
const CONFLICT = 409;

/** Whether an error of `op` goes to the alert (the others show elsewhere, D39-5, D40-5). */
function alerts(op: GitOperation, error: ApiError): boolean {
  if (error.code === CANCELLED || error.code === RECORDED) return false;
  if (op === 'update') return error.status !== CONFLICT;
  return op === 'fetch';
}

/** The texts of a control, idle and while its transport runs. */
const IDLE = defineMessages({
  fetch: { id: 'shell.git.fetch' },
  update: { id: 'shell.git.update' },
  push: { id: 'shell.git.push' },
});
const RUNNING = defineMessages({
  fetch: { id: 'shell.git.fetching' },
  update: { id: 'shell.git.updating' },
  push: { id: 'shell.git.pushing' },
});

function GitStatusOf({ pid }: { pid: string }): ReactNode {
  const intl = useIntl();
  const header = useQuery(projectHeaderQuery(pid));
  const operation = useGitOperation();
  const running = useRunningGitOperation(pid);
  const readOnlyId = useId();
  const controller = useRef<AbortController | null>(null);
  const buttons = {
    fetch: useRef<HTMLButtonElement>(null),
    update: useRef<HTMLButtonElement>(null),
    push: useRef<HTMLButtonElement>(null),
  };
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [own, setOwn] = useState<GitOperation | null>(null);
  // The control to give the focus back to once the transport ended (R3, D40-4).
  const refocus = useRef<GitOperation | null>(null);

  useEffect(() => {
    if (own === null && refocus.current !== null) {
      const target = buttons[refocus.current].current ?? buttons.fetch.current;
      refocus.current = null;
      target?.focus();
    }
  });
  // Leaving the project (or the page) cancels a fetch or a push still running.
  useEffect(() => () => controller.current?.abort(), []);

  if (!header.data) return null;
  const { repository, conditions, identity } = header.data;
  const view = gitStatusView(repository, conditions, identity.kind === 'member');
  const lastSuccessAt = repository.sync.fetch.lastSuccessAt;
  const shownRefusal =
    refusal && view.sync && refusal.lastSuccessAt === lastSuccessAt && refusal.state === repository.state
      ? refusal.error
      : null;
  const busy = running !== undefined || own !== null;
  const pushCommits = view.sync?.actions.push?.commits ?? 0;

  const start = (op: GitOperation): void => {
    if (busy) return;
    if (op !== 'fetch' && view.sync?.actions.readOnly) return;
    // An update cannot be cancelled (RP-37): no signal.
    const c = op === 'update' ? null : new AbortController();
    controller.current = c;
    setRefusal(null);
    setOwn(op);
    operation.mutate(
      { pid, op, ...(c ? { signal: c.signal } : {}) },
      {
        onError: (error) => {
          if (alerts(op, error)) setRefusal({ error, lastSuccessAt, state: repository.state });
          if (op === 'push' && error.code !== CANCELLED) showToast(pushFailureToast(pid, pushCommits, error));
        },
        onSettled: () => {
          controller.current = null;
          const active = document.activeElement;
          if (active !== null && (active === cancelButton.current || active === buttons[op].current)) {
            refocus.current = op;
          }
          setOwn(null);
        },
      },
    );
  };
  const cancel = (): void => {
    controller.current?.abort();
  };
  const syncButton = (op: GitOperation) => {
    const readOnly = op !== 'fetch' && view.sync?.actions.readOnly === true;
    return (
      <button
        ref={buttons[op]}
        type="button"
        className={`button git-${op}`}
        // Focusable while disabled (D37-3 pattern): a press is ignored.
        aria-disabled={busy || readOnly ? true : undefined}
        aria-describedby={readOnly ? readOnlyId : undefined}
        onClick={() => start(op)}
      >
        <FormattedMessage {...((own ?? running) === op ? RUNNING[op] : IDLE[op])} />
      </button>
    );
  };
  const runningNow = own ?? running;

  return (
    <section className="git-status" aria-label={intl.formatMessage({ id: 'shell.git.label' })}>
      <p className="git-head">
        {view.head.branch === null ? (
          <FormattedMessage
            id="shell.git.detached"
            values={{
              commit: (
                <code translate="no" key="c">
                  {view.head.commit ?? ''}
                </code>
              ),
            }}
          />
        ) : (
          <>
            <code translate="no" className="git-branch">
              {view.head.branch}
            </code>
            {view.head.commit !== null && (
              <code translate="no" className="git-commit">
                {view.head.commit}
              </code>
            )}
          </>
        )}
      </p>
      <div aria-live="polite" className="git-lines">
        {view.sync && <CopyText line={view.sync.line} />}
        {view.sync?.actions.push && (
          <p className="git-line git-to-push">
            <FormattedMessage id="shell.git.toPush" values={{ count: view.sync.actions.push.commits }} />
          </p>
        )}
        {view.localChanges > 0 && (
          <p className="git-line">
            <FormattedMessage id="shell.git.localChanges" values={{ count: view.localChanges }} />
          </p>
        )}
        {view.sync?.fetchError && <FetchFailure error={view.sync.fetchError} />}
        {view.sync?.updateError && <UpdateFailure error={view.sync.updateError} />}
      </div>
      {view.sync && (
        <div className="git-actions">
          {syncButton('fetch')}
          {view.sync.actions.update && syncButton('update')}
          {view.sync.actions.push && syncButton('push')}
          {own !== null && own !== 'update' && (
            <button ref={cancelButton} type="button" className="button button-quiet" onClick={cancel}>
              <FormattedMessage id="common.action.cancel" />
            </button>
          )}
        </div>
      )}
      {view.sync?.actions.readOnly && (view.sync.actions.update || view.sync.actions.push) && (
        <p id={readOnlyId} className="git-line">
          <FormattedMessage id="shell.git.readOnly" />
        </p>
      )}
      <p role="status" className="visually-hidden">
        {runningNow !== undefined && runningNow !== null && <FormattedMessage {...RUNNING[runningNow]} />}
      </p>
      {/* Outside the parts that change with the header's data (Wave 4 lesson); inserted with its
          content, so it is announced and the page holds no empty alert besides the views' own. */}
      {shownRefusal && (
        <div role="alert" className="git-alert">
          <ErrorText error={shownRefusal} />
        </div>
      )}
    </section>
  );
}

/** The copy line (D39-7). */
function CopyText({ line }: { line: CopyLine }): ReactNode {
  switch (line.kind) {
    case 'inSync':
      return (
        <p className="git-line git-in-sync">
          <FormattedMessage id="shell.git.inSync" />
        </p>
      );
    case 'ahead':
      return (
        <p className="git-line">
          <FormattedMessage id="shell.git.ahead" values={{ count: line.ahead }} />
        </p>
      );
    case 'behind':
      return (
        <p className="git-line git-behind">
          <FormattedMessage id="shell.git.behind" values={{ count: line.behind }} />
        </p>
      );
    case 'diverged':
      return (
        <p className="git-line git-behind">
          <FormattedMessage id="shell.git.diverged" values={{ ahead: line.ahead, behind: line.behind }} />
        </p>
      );
    case 'noUpstream':
      return (
        <p className="git-line">
          {line.upstream === null ? (
            <FormattedMessage id="shell.git.noUpstream" />
          ) : (
            <FormattedMessage id="shell.git.upstreamMissing" values={{ upstream: line.upstream }} />
          )}
        </p>
      );
    case 'none':
      return null;
  }
}

/** "Fetch failed — last fetched at …", the code's text, git's message (Y-03.1, Y-03.2). */
function FetchFailure({ error }: { error: FetchErrorView }): ReactNode {
  const intl = useIntl();
  const last = lastFetched(error.lastSuccessAt);
  const values =
    last.when === 'none'
      ? { last: 'none', time: '', date: '' }
      : last.when === 'today'
        ? { last: 'today', time: intl.formatTime(last.at, { timeStyle: 'short' }), date: '' }
        : { last: 'other', time: '', date: intl.formatDate(last.at, { dateStyle: 'medium', timeStyle: 'short' }) };
  return (
    <div className="git-failure">
      <p className="git-line git-error">
        <span>
          <FormattedMessage id="shell.git.fetchFailed" values={values} />
        </span>
        {error.message !== '' && <GitMessage message={error.message} />}
      </p>
      {error.code && (
        <p className="git-line">
          <FormattedMessage {...errorMessage({ code: error.code, message: '', detail: undefined }).descriptor} />
        </p>
      )}
    </div>
  );
}

/** The last update error: its catalogue text, or "Update failed" with git's message (D39-6). */
function UpdateFailure({ error }: { error: UpdateSyncError }): ReactNode {
  if (error.code === 'git-refused') {
    return (
      <p className="git-line git-error">
        <span>
          <FormattedMessage id="shell.git.updateFailed" />
        </span>
        {error.message && <GitMessage message={error.message} />}
      </p>
    );
  }
  const { descriptor, values } = errorMessage({ code: error.code, message: '', detail: error.detail });
  return (
    <p className="git-line git-error">
      <FormattedMessage {...descriptor} values={values} />
    </p>
  );
}

/**
 * An info button with git's message (D39-4; reviews R6, R2-1 … R2-3): a tooltip on hover and
 * keyboard focus while closed, and on press (a tap shows no tooltip) React Aria's dismissable
 * popover dialog "Git's message" — it takes the focus, closes on a second press, a press outside
 * or Escape, and gives the focus back to the button. The message is also the button's description,
 * kept out of the polite live region (`hidden`, review R8).
 */
function GitMessage({ message }: { message: string }): ReactNode {
  const intl = useIntl();
  const id = useId();
  const [open, setOpen] = useState(false);
  const label = intl.formatMessage({ id: 'shell.git.message' });
  return (
    <>
      {' '}
      <DialogTrigger isOpen={open} onOpenChange={setOpen}>
        <TooltipTrigger delay={300} isDisabled={open}>
          <Button className="icon-button git-info" aria-label={label} aria-describedby={id}>
            <InfoSign />
          </Button>
          <Tooltip className="git-tooltip" placement="end">
            {message}
          </Tooltip>
        </TooltipTrigger>
        <Popover placement="end" className="git-tooltip git-message-popover">
          <Dialog aria-label={label} className="git-message">
            {message}
          </Dialog>
        </Popover>
      </DialogTrigger>
      <span id={id} hidden>
        {message}
      </span>
    </>
  );
}
