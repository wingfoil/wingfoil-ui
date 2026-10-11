/**
 * The local-state store port (adr-002) and its shared behaviour (spec-006 §2–§5): read once at
 * open and again before every mutation, mutations serialised by an in-process lock, every write
 * checked against the schema, remotes stored without userinfo (REQ-SEC-09), warnings for the
 * shell (`GET /api/server`). Adapters only read and write the whole state.
 */
import type { ProjectEntry, StateFile, StateWarning } from '@wingfoil-ui/contracts';
import { newProjectId, type RandomSource } from './ids.js';
import { InvalidStateError, STATE_VERSION, stateProblem } from './schema.js';

/** What the caller gives to add a project; the store draws the id and the add time. */
export interface NewProject {
  /** Absolute realpath of the working directory. */
  path: string;
  /** `dna.project.name`. */
  name: string;
  /** URL of `origin`, or `""`; any userinfo is removed before it is stored. */
  remote: string;
}

/** Fields a caller may change on a listed project. */
export type ProjectPatch = Partial<Pick<ProjectEntry, 'name' | 'remote' | 'roleView'>>;

/** Options shared by every adapter. */
export interface StoreOptions {
  /** Clock of `addedAt` and of the corrupt-copy name (default: now). */
  now?: () => Date;
  /** Random source of the ids (default: `crypto.randomBytes`). */
  random?: RandomSource;
}

/** The mutable view a {@link StateStore.transaction} works on. */
export interface StateDraft {
  /** A copy of the current list, re-read just before; change it in place. */
  projects: ProjectEntry[];
  /** A new entry for `project` with a fresh id unique in `projects` (not added: push it). */
  create(project: NewProject): ProjectEntry;
}

/** The local-state store port. Every value handed out is a copy. */
export interface StateStore {
  /** Where the state lives: the state directory, or `memory` for the fake. */
  readonly location: string;
  /** True when the file was written by a newer build: changes live for this run only. */
  readonly readOnly: boolean;
  /** The project list, in insertion order. */
  projects(): ProjectEntry[];
  /** The project with exactly this id (never resolved as a path, REQ-SEC-04). */
  get(id: string): ProjectEntry | undefined;
  /**
   * Re-read the state (another console may have changed it) and resolve with the list. A
   * read-only store keeps its in-memory list.
   */
  reload(): Promise<ProjectEntry[]>;
  /** Warnings for the shell (`GET /api/server`, spec-006 §4). */
  warnings(): StateWarning[];
  /** The whole state as last read or written. */
  snapshot(): StateFile;
  /**
   * Re-read the state, run `fn` on a draft under the lock, and write the result if it changed.
   * When `fn` throws (a refusal), nothing is written. Resolves with what `fn` returned.
   *
   * Keep transactions short: the lock blocks every other console's mutation. Never clone, run the
   * CLI or wait on the network inside `fn`: do the slow work first, then re-check its premises
   * (duplicates, the list) inside. Never call a store mutation (`add`, `update`, `remove`,
   * `transaction`) inside `fn`: the store is not re-entrant and would wait forever. `fn` may run twice (a dry run before the first write ever, so
   * a no-op creates no directory): apart from the draft it must have no side effect.
   */
  transaction<T>(fn: (draft: StateDraft) => T | Promise<T>): Promise<T>;
  /** Append a project; resolves with the stored entry. */
  add(project: NewProject): Promise<ProjectEntry>;
  /** Drop a project (no file of the project is touched); resolves with the removed entry. */
  remove(id: string): Promise<ProjectEntry | undefined>;
  /** Change `name`, `remote` or `roleView` of a project (other fields are ignored); resolves with the stored entry. */
  update(id: string, patch: ProjectPatch): Promise<ProjectEntry | undefined>;
}

/** What an adapter's read found. */
export interface ReadOutcome {
  state: StateFile;
  /** The file is from a newer build: never write it back. */
  readOnly: boolean;
  warning?: StateWarning;
}

/** An adapter: reads and writes the whole state. */
export interface StateBackend {
  readonly location: string;
  read(): Promise<ReadOutcome>;
  write(state: StateFile): Promise<void>;
  /** Run `fn` (a re-read, then maybe a write) while no other process mutates the same state. */
  lock<T>(fn: () => Promise<T>): Promise<T>;
  /** True while nothing was ever written (the file adapter: no state directory yet). */
  pristine(): Promise<boolean>;
}

/** The state of a first start. */
export function emptyState(): StateFile {
  return { version: STATE_VERSION, projects: [], settings: {}, actionLog: [] };
}

const URL_FORM = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)(.*)$/s;

/**
 * `remote` trimmed and without any credential (REQ-SEC-09): in the URL form the userinfo is
 * removed (`https://user:token@host/x.git` → `https://host/x.git`) and any other `@` is
 * percent-encoded, so no `@` is left; a URL that does not parse loses everything up to its last
 * `@`. The scp-like form `user@host:path` names a login and is kept as written; a password in it
 * (`user:password@host:path`) is removed (W5-18).
 * git's `<transport>::<address>` form keeps its prefix and strips its address (bug-006 review).
 */
export function stripUserinfo(remote: string): string {
  const trimmed = remote.trim();
  const transport = /^((?:[A-Za-z][A-Za-z0-9+.-]*::\s*)+)(.*)$/s.exec(trimmed);
  if (transport) return `${transport[1]!}${stripUserinfo(transport[2]!)}`;
  const match = URL_FORM.exec(trimmed);
  if (!match) {
    // The scp-like `user:password@host:path` keeps its login, never its password (W5-18).
    const scp = /^([^@/:]+):[^@/]*@([^/:]+:.*)$/s.exec(trimmed);
    return scp ? `${scp[1]!}@${scp[2]!}` : trimmed;
  }
  if (!trimmed.includes('@')) return trimmed;
  try {
    const url = new URL(trimmed);
    url.username = '';
    url.password = '';
    return url.href.replaceAll('@', '%40');
  } catch {
    const rest = match[2]!;
    return `${match[1]!}${rest.slice(rest.lastIndexOf('@') + 1)}`;
  }
}

/** ISO 8601 UTC to the second, as spec-006 §2 shows `addedAt`. */
function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, 'Z');
}

class BackedStateStore implements StateStore {
  readonly #backend: StateBackend;
  readonly #now: () => Date;
  readonly #random: RandomSource | undefined;
  #state: StateFile = emptyState();
  #readOnly = false;
  readonly #warnings: StateWarning[] = [];
  #lock: Promise<unknown> = Promise.resolve();

  constructor(backend: StateBackend, options: StoreOptions) {
    this.#backend = backend;
    this.#now = options.now ?? (() => new Date());
    this.#random = options.random;
  }

  get location(): string {
    return this.#backend.location;
  }

  get readOnly(): boolean {
    return this.#readOnly;
  }

  async load(): Promise<void> {
    this.#accept(await this.#backend.read());
  }

  #accept(outcome: ReadOutcome): void {
    this.#state = outcome.state;
    this.#readOnly = outcome.readOnly;
    const { warning } = outcome;
    if (warning && !this.#warnings.some((w) => JSON.stringify(w) === JSON.stringify(warning))) {
      this.#warnings.push(warning);
    }
  }

  projects(): ProjectEntry[] {
    return structuredClone(this.#state.projects);
  }

  get(id: string): ProjectEntry | undefined {
    const entry = this.#state.projects.find((p) => p.id === id);
    return entry && { ...entry };
  }

  warnings(): StateWarning[] {
    return structuredClone(this.#warnings);
  }

  snapshot(): StateFile {
    return structuredClone(this.#state);
  }

  /**
   * Run `fn` after every earlier operation of this store (in-process lock). The lock between
   * processes is taken by {@link transaction}; a plain read needs none (writes are atomic renames).
   */
  #serialise<T>(fn: () => Promise<T>): Promise<T> {
    const done = this.#lock.then(fn, fn);
    this.#lock = done.catch(() => undefined);
    return done;
  }

  reload(): Promise<ProjectEntry[]> {
    return this.#serialise(async () => {
      if (!this.#readOnly) this.#accept(await this.#backend.read());
      return this.projects();
    });
  }

  transaction<T>(fn: (draft: StateDraft) => T | Promise<T>): Promise<T> {
    return this.#serialise(async (): Promise<T> => {
      if (this.#readOnly) return (await this.#attempt(fn, false)).result;
      if (await this.#backend.pristine()) {
        // Nothing written yet: run without the lock (which would create the directory) and take
        // it only when there is something to write.
        const dry = await this.#attempt(fn, false, true);
        if (!dry.changed) return dry.result;
      }
      return this.#backend.lock(async () => (await this.#attempt(fn, true, true)).result);
    });
  }

  /**
   * Run `fn` on a draft of the state (re-read first when `reread`) and keep the result; write it
   * when `write` and it changed. A dry run (`write` false on a writable store) keeps nothing.
   */
  async #attempt<T>(
    fn: (draft: StateDraft) => T | Promise<T>,
    write: boolean,
    reread = false,
  ): Promise<{ result: T; changed: boolean }> {
    // Re-read first: another console on the same directory may have changed the list.
    if (reread) this.#accept(await this.#backend.read());
    const projects = structuredClone(this.#state.projects);
    const draft: StateDraft = { projects, create: (project) => this.#create(project, projects) };
    const result = await fn(draft);
    const next: StateFile = {
      ...this.#state,
      projects: draft.projects.map((p) => ({ ...p, remote: stripUserinfo(p.remote) })),
    };
    if (JSON.stringify(next) === JSON.stringify(this.#state)) return { result, changed: false };
    const problem = stateProblem(next);
    if (problem !== undefined) throw new InvalidStateError(`invalid state: ${problem}`);
    if (write) await this.#backend.write(next);
    if (write || this.#readOnly) this.#state = next;
    return { result, changed: true };
  }

  #create(project: NewProject, projects: readonly ProjectEntry[]): ProjectEntry {
    let id: string;
    do id = newProjectId(this.#random);
    while (projects.some((p) => p.id === id));
    return {
      id,
      path: project.path,
      name: project.name,
      remote: stripUserinfo(project.remote),
      addedAt: isoSeconds(this.#now()),
      roleView: '',
    };
  }

  async add(project: NewProject): Promise<ProjectEntry> {
    const id = await this.transaction((draft) => {
      const entry = draft.create(project);
      draft.projects.push(entry);
      return entry.id;
    });
    return this.get(id)!;
  }

  remove(id: string): Promise<ProjectEntry | undefined> {
    return this.transaction((draft) => {
      const index = draft.projects.findIndex((p) => p.id === id);
      return index < 0 ? undefined : draft.projects.splice(index, 1)[0];
    });
  }

  async update(id: string, patch: ProjectPatch): Promise<ProjectEntry | undefined> {
    const found = await this.transaction((draft) => {
      const entry = draft.projects.find((p) => p.id === id);
      if (entry) {
        // Only these fields: the id and the path of an entry never change.
        if (patch.name !== undefined) entry.name = patch.name;
        if (patch.remote !== undefined) entry.remote = patch.remote;
        if (patch.roleView !== undefined) entry.roleView = patch.roleView;
      }
      return entry !== undefined;
    });
    return found ? this.get(id) : undefined;
  }
}

/** Open a store over `backend`: the state is read once here. */
export async function openStore(backend: StateBackend, options: StoreOptions = {}): Promise<StateStore> {
  const store = new BackedStateStore(backend, options);
  await store.load();
  return store;
}
