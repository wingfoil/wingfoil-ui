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
 * - while the fetch runs, *Fetch* stays in place, aria-disabled, reading "Fetching…" (D39-13).
 *
 * Keyed by pid: nothing of one project's running fetch or alert reaches another.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, DialogTrigger, Popover, Tooltip, TooltipTrigger } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import type { ApiError } from '../api/client.js';
import { errorMessage } from '../api/error-message.js';
import { CANCELLED, useGitOperation } from '../api/git.js';
import { projectHeaderQuery } from '../api/queries.js';
import { ErrorText } from '../shell/ErrorText.js';
import { InfoSign } from '../shell/icons.js';
import { gitStatusView, lastFetched, type CopyLine, type FetchErrorView } from './model.js';
import type { UpdateSyncError } from '@wingfoil-ui/contracts';
import './git-status.css';

/** The git status of project `pid`. */
export function GitStatus({ pid }: { pid: string }): ReactNode {
  return <GitStatusOf key={pid} pid={pid} />;
}

/**
 * A refusal of the manual fetch, and the read it was seen against (D39-5): it clears when a later
 * fetch succeeded, when the repository state moved or when the sync part goes (review R7).
 */
interface Refusal {
  error: ApiError;
  lastSuccessAt: string | null;
  state: string;
}

/** Codes the server records in `sync.fetch.lastError`: shown by the failure line, not the alert. */
const RECORDED = 'git-refused';

function GitStatusOf({ pid }: { pid: string }): ReactNode {
  const intl = useIntl();
  const header = useQuery(projectHeaderQuery(pid));
  const operation = useGitOperation();
  const controller = useRef<AbortController | null>(null);
  const fetchButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [running, setRunning] = useState(false);
  const refocus = useRef(false);

  useEffect(() => {
    if (!running && refocus.current) {
      refocus.current = false;
      fetchButton.current?.focus();
    }
  }, [running]);
  // Leaving the project (or the page) cancels a fetch still running.
  useEffect(() => () => controller.current?.abort(), []);

  if (!header.data) return null;
  const { repository, conditions } = header.data;
  const view = gitStatusView(repository, conditions);
  const lastSuccessAt = repository.sync.fetch.lastSuccessAt;
  const shownRefusal =
    refusal && view.sync && refusal.lastSuccessAt === lastSuccessAt && refusal.state === repository.state
      ? refusal.error
      : null;

  const startFetch = (): void => {
    if (running) return;
    const c = new AbortController();
    controller.current = c;
    setRefusal(null);
    setRunning(true);
    operation.mutate(
      { pid, op: 'fetch', signal: c.signal },
      {
        onError: (error) => {
          if (error.code !== CANCELLED && error.code !== RECORDED) {
            setRefusal({ error, lastSuccessAt, state: repository.state });
          }
        },
        onSettled: () => {
          controller.current = null;
          // Cancel goes away with the run: its focus moves to Fetch, never to the page (review R3).
          if (cancelButton.current !== null && document.activeElement === cancelButton.current) refocus.current = true;
          setRunning(false);
        },
      },
    );
  };
  const cancel = (): void => {
    refocus.current = true;
    controller.current?.abort();
  };

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
          <button
            ref={fetchButton}
            type="button"
            className="button git-fetch"
            // Focusable while it runs (D37-3 pattern): a press is ignored.
            aria-disabled={running ? true : undefined}
            onClick={startFetch}
          >
            {running ? <FormattedMessage id="shell.git.fetching" /> : <FormattedMessage id="shell.git.fetch" />}
          </button>
          {running && (
            <button ref={cancelButton} type="button" className="button button-quiet" onClick={cancel}>
              <FormattedMessage id="common.action.cancel" />
            </button>
          )}
        </div>
      )}
      <p role="status" className="visually-hidden">
        {running && <FormattedMessage id="shell.git.fetching" />}
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
