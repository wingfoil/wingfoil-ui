---
id: bug-016-a-token-pasted-into-a-tab-that-already-shows-the-console-is-not-read-without-a-reload
type: bug
title: "A token pasted into a tab that already shows the console is not read without a reload"
status: resolved
severity: "low"        # REQUIRED — critical | high | medium | low
release-origin: "v0.1" # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "web"          # optional — server | web | contracts
wingfoil_version: ""   # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: "Chrome 154" # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

The page reads the `#token=…` fragment only once, when it first loads, so a console URL pasted into a
tab that already shows that console (same origin and path, only the fragment differs) does not
start a session: the browser does not reload the page and it keeps showing *This page is no longer
recognised by the console*.

## Steps to Reproduce

1. Start the console: `node bin/wingfoil-ui.cjs --port 4600 --no-open` (any console, no project
   needed); it prints `WingFoil UI is running at http://127.0.0.1:4600/#token=…`.
2. In a browser tab, open `http://127.0.0.1:4600/` without the fragment (or a tab left from an
   earlier start of the console on the same port): the page shows *This page is no longer
   recognised by the console*.
3. Paste the printed URL, with its `#token=…`, into the address bar of that same tab and press
   Enter.

## Expected Behavior

The page reads the new token, exchanges it (`POST /api/session`) and shows the console, as it does
when the URL is opened in a new tab — the URL the message tells the user to open is the one that
was pasted.

## Actual Behavior

Nothing changes: only the fragment changed, so the browser does not reload the page; the page does
not look at the new fragment and still shows *This page is no longer recognised by the console*.
Opening the same URL in a new tab, or pressing F5 after pasting it, works.

## Evidence

- Observed by the approver on 2026-10-16 with a console of `main` `cce3656` (Chrome 154). The
  console's request log for that tab shows `GET /api/server` and `GET /api/events` answered 401
  and no `POST /api/session` at all; the only session exchange in the log came from another browser
  that opened the URL in a fresh tab (204).
- `web/src/session/session.ts` `bootstrapSession()` reads `window.location.hash` once, before the
  first render (`web/src/main.tsx`); nothing listens for `hashchange` (`grep -rn hashchange
  web/src` finds nothing).

## Notes

- Workaround: open the URL in a new tab, or reload the tab after pasting it (the user guide's *The
  session and the browser* says "open the URL the console printed").
- Suspected fix: on `hashchange` with a `token` in the fragment, run the same exchange (and the
  same `history.replaceState`), then re-read everything; or reload the page when a token fragment
  arrives. The lost-session page could also say "open it in a new tab or reload".
- Not a security issue: the token stays in the fragment (never sent), it is the console's own.

## Triage & Execution Notes

<!-- Running log, not the retrospective itself.
     - triage (bug-ingest): severity call, wontfix/duplicate rationale if rejected to `closed`.
     - fix: once fix task(s) exist (release-planning/build-backlog), day-to-day execution notes
       live on those tasks (docs/04_memory/{release}/{id}.md, `bug: {this id}`, their own
       Execution Notes section) — this section only needs a pointer plus anything that doesn't
       belong on a specific fix task (e.g. why 2 tasks were needed instead of 1). -->
- fix: **absorbed into task-040-update-and-push-from-the-sidebar** (AC "bug-016", `bug:` list of the task; the approver's choice at the start of Wave 6, 2026-10-17); `triaged → planned` set by hand (directive `wingfoil-cli` W-26).
