# SARD — 5. Security, Roles & Governance

**Version:** 0.2 · **Date:** 2026-10-02 (0.2: coherence audit fixes — session 6) · **Status:** Draft — specification-downcast session 4

Shell and conventions: `00_sard.md`. The protection of the local server (X4) is mandatory and
distinct from permissions between team members, which belong to WingFoil (L6).

---

### REQ-SEC-01 — Loopback only

| Field | |
|-------|--|
| Release | v0.1 |
| Description | The server listens on 127.0.0.1 and ::1 only. |
| Rationale | Nobody on the network reads or acts on the user's projects (X4; MVP canvas metric *Local server safety*). |
| Traceability | US-X-03 · X-03.1, X-03.2 · X4 |
| Fit criterion | [boolean] Every listening socket of the server process is bound to a loopback address; a connection to the machine's network address is refused. |
| Verified by | e2e-smoke `local-security` |

### REQ-SEC-02 — Session token

| Field | |
|-------|--|
| Release | v0.1 |
| Description | Each start issues a new random session token (≥ 128 bits), given in the printed URL, removed from the address bar after the first load, and required on every HTTP request and event stream; it is never written to logs or disk. |
| Rationale | Only the user's browser session drives the projects (X4). |
| Traceability | US-X-02, US-X-04 · X-02.1, X-02.2, X-04.1 · X4 |
| Fit criterion | [percentage] 100 % of requests without the current token (or with a previous start's) get HTTP 401 and start 0 processes; the token appears in 0 log lines. |
| Verified by | e2e-smoke `local-security` |

### REQ-SEC-03 — Origin and Host checks

| Field | |
|-------|--|
| Release | v0.1 |
| Description | Every request, reads and writes, must carry a Host of `127.0.0.1:<port>`, `localhost:<port>` or `[::1]:<port>`, and an Origin (when present) of the console itself; otherwise HTTP 403. |
| Rationale | Blocks cross-site requests and DNS rebinding from other web pages (X4). |
| Traceability | US-X-04 · X-04.1, X-04.2, X-04.3 · X4 |
| Fit criterion | [percentage] 100 % of requests with a foreign Origin or Host get HTTP 403 and start 0 processes, whatever the method. |
| Verified by | e2e-smoke `local-security` |

### REQ-SEC-04 — Opaque project ids

| Field | |
|-------|--|
| Release | v0.1 |
| Description | URLs and API paths identify projects by an opaque id issued by the server; no file-system path appears in a URL; an unknown id gets HTTP 404. |
| Rationale | No exposure of the folder layout; no path injection through ids (X4). |
| Traceability | US-X-05 · X-05.1, X-05.2 · X4 |
| Fit criterion | [boolean] Across the e2e suite, 0 requested URLs contain a fixture's absolute path; a request for the id `../../etc` gets 404. |
| Verified by | e2e-smoke `local-security` |

### REQ-SEC-05 — No shell

| Field | |
|-------|--|
| Release | v0.1 |
| Description | CLI and git processes are started with `execFile` and argument arrays; user input (titles, reasons, paths, URLs) is passed as arguments, never interpolated into a command line. |
| Rationale | No command injection (X4). |
| Traceability | US-G-15, US-G-06, US-S-04 · G-15.1, G-06.2, S-04.3 · X4, S1 |
| Fit criterion | [boolean] A lint rule finds 0 uses of `exec`, `execSync` or `shell: true` in `server/`; a decision-log titled `x"; touch /tmp/pwned; "` is created with that literal title and `/tmp/pwned` does not exist. |
| Verified by | lint · e2e |

### REQ-SEC-06 — Confinement to the repository

| Field | |
|-------|--|
| Release | v0.1 (documents) · v0.3 (Files) |
| Description | Files, documents and links resolve paths with `realpath` and serve only paths inside the project repository; `..` and symlinks that escape it are refused or marked. |
| Rationale | The UI never reads beyond the project (X4, R8). |
| Traceability | US-R-11, US-R-09 · R-11.1, R-11.2, R-09.3 · R8, R4, X4 |
| Fit criterion | [percentage] 100 % of the path-traversal cases of the security suite (`..`, encoded `..`, absolute paths, escaping symlinks) return 404 or the "outside the repository" marker with 0 bytes of the target. |
| Verified by | e2e-smoke `local-security` |

### REQ-SEC-07 — Gate authority stays with WingFoil

| Field | |
|-------|--|
| Release | v0.2 |
| Description | The UI offers a gate's outcomes only to members holding the role WingFoil requires (0.2.2: `approver`, W-13); other members see the gate as informational with the members who can act. The UI defines no permissions of its own; action permissions are shown once WingFoil implements them (L6, request R-09). |
| Rationale | One owner for the rules (session 3 decision; supersedes Q11). |
| Traceability | US-T-06, US-G-09, US-G-08, US-S-11 · T-06.1, T-06.2, G-09.1, G-09.2, G-09.3, G-08.1, G-08.3, S-11.1 · G2, S9 |
| Fit criterion | [boolean] On the fixtures with Sam and Casey with and without `approver`, the outcomes are offered if and only if the member holds `approver`; `ui.yaml` and the server configuration contain 0 permission rules. |
| Verified by | e2e |

### REQ-SEC-08 — Read-only for unidentified users, enforced by the server

| Field | |
|-------|--|
| Release | v0.2 |
| Description | Users not in the team, with no git email or with an ambiguous one get no write action in the UI, and the server refuses their write requests; *How to join* names the tech leads (or says none is declared) and gives the exact `wingfoil dna add team.members …` command. |
| Rationale | Q5; joining is a governed change made by the team. |
| Traceability | US-S-13, US-S-15, US-T-01, US-C-08, US-C-09, US-C-02 · S-13.2, S-15.2, T-01.2, C-08.1, C-08.2, C-09.1, C-09.2, C-02.5 · S4, C2 |
| Fit criterion | [percentage] 100 % of write requests from such users get HTTP 403 and start 0 processes; every listed scenario passes. |
| Verified by | e2e · API test |

### REQ-SEC-09 — No secrets stored

| Field | |
|-------|--|
| Release | v0.1 |
| Description | `ui.yaml`, the local UI state and the server logs contain no secret: no session token, no git credential, no environment variable value. Git authentication is left to the user's git configuration. |
| Rationale | Directive `security-secrets`; W-11 (the secret scan would include `ui.yaml`). |
| Traceability | US-C-02, US-C-07, US-X-02 · C-02.1, C-07.2, X-02.1 · C1, C4, X4 |
| Fit criterion | [boolean] A secret scan over `ui.yaml`, the local state directory and the logs after the e2e suite reports 0 findings. |
| Verified by | e2e (secret scan) |

### REQ-SEC-10 — Dogfooding

| Field | |
|-------|--|
| Release | v0.2 (this repository) · v0.3 (WingFoil repository) |
| Description | From v0.2 the gates of the WingFoil UI repository are passed from the UI; from v0.3 those of the WingFoil repository too. |
| Rationale | MVP canvas metric *Adoption*; sequencer rule 5. |
| Traceability | US-G-04 · G-04.1 · G2 · `08_mvp-canvas.md` |
| Fit criterion | [percentage] Between the v0.2 and the v0.3 releases, ≥ 80 % of the approve/reject commits of this repository have their hash in the server's local action log (the list of commits the UI caused: hash and time, no other data); the same from v0.3 for the WingFoil repository. |
| Verified by | retrospective (`wf(…)` history) |
