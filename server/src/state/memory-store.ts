/** The in-memory fake of the local-state store (adr-002), for tests of the domain and routes. */
import type { StateFile } from '@wingfoil-ui/contracts';
import {
  emptyState,
  openStore,
  type ReadOutcome,
  type StateBackend,
  type StateStore,
  type StoreOptions,
} from './store.js';

/** Options of {@link createMemoryStateStore}. */
export interface MemoryStoreOptions extends StoreOptions {
  /** The state to start from (default: empty). */
  initial?: StateFile;
}

class MemoryBackend implements StateBackend {
  readonly location = 'memory';
  #state: StateFile;

  constructor(initial: StateFile) {
    this.#state = structuredClone(initial);
  }

  read(): Promise<ReadOutcome> {
    return Promise.resolve({ state: structuredClone(this.#state), readOnly: false });
  }

  write(state: StateFile): Promise<void> {
    this.#state = structuredClone(state);
    return Promise.resolve();
  }

  lock<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

/** A store that keeps its state in memory, with the same rules as the file adapter. */
export function createMemoryStateStore(options: MemoryStoreOptions = {}): Promise<StateStore> {
  const { initial, ...rest } = options;
  return openStore(new MemoryBackend(initial ?? emptyState()), rest);
}
