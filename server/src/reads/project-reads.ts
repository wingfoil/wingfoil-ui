/**
 * Every read of one project (REQ-ARC-04, adr-001 D1/D1a): through the CLI wherever it exposes the
 * data, and directly, read-only, from the closed allow-list for what WingFoil 0.2.2 does not —
 * `.wingfoil/memory.yaml`, the element files at the paths `memory search` returns, the directive
 * files at the paths `directives list` returns. No path is ever built from a caller's value: an
 * element or a directive is looked up by id in the CLI's list, and only its listed path is read.
 * Nothing here writes. Caching and batching are the caller's (task-010).
 */
import type { DirectiveEntry, MemoryMatch, MemoryYaml } from '@wingfoil-ui/contracts';
import type { CliArgs, CliOutput, WingfoilCli } from '../cli/adapter.js';
import type { CliCommandOutputs } from '../cli/commands.js';
import { ARCHIVED_STATES, type ArchivedStatus } from '../presets/wingfoil.js';
import { nodeReadFs, type ReadFs } from './confine.js';
import { readDirective, type DirectiveContent } from './directive.js';
import { readElement, type ElementContent } from './element.js';
import { readMemoryYaml } from './memory-yaml.js';

// WingFoil's archived set lives in `presets/` (REQ-ARC-05).
export type { ArchivedStatus } from '../presets/wingfoil.js';

/** Options of {@link ProjectReads}. */
export interface ProjectReadsOptions {
  /** Project root (the realpath of the working directory). */
  root: string;
  /** The project's CLI. */
  cli: WingfoilCli;
  /** Read port of the direct reads (default: the local file system). */
  fs?: ReadFs;
}

/** An element: its `memory search` match and its file. */
export interface ElementRead {
  match: MemoryMatch;
  content: ElementContent;
}

/** A directive: its `directives list` entry and its file. */
export interface DirectiveRead {
  entry: DirectiveEntry;
  content: DirectiveContent;
}

/** The reads of one project. */
export class ProjectReads {
  private readonly fs: ReadFs;

  constructor(private readonly options: ProjectReadsOptions) {
    this.fs = options.fs ?? nodeReadFs;
  }

  /** `dna show`. */
  dna(signal?: AbortSignal): Promise<CliOutput<CliCommandOutputs['dna show']>> {
    return this.options.cli.run('dna show', args(signal));
  }

  /** `paths`. */
  paths(signal?: AbortSignal): Promise<CliOutput<CliCommandOutputs['paths']>> {
    return this.options.cli.run('paths', args(signal));
  }

  /** `workflow list`. */
  workflows(signal?: AbortSignal): Promise<CliOutput<CliCommandOutputs['workflow list']>> {
    return this.options.cli.run('workflow list', args(signal));
  }

  /** `directives list`. */
  directives(signal?: AbortSignal): Promise<CliOutput<CliCommandOutputs['directives list']>> {
    return this.options.cli.run('directives list', args(signal));
  }

  /** `memory search`, without filters: every element that is not archived (spec-001 §3). */
  elements(signal?: AbortSignal): Promise<CliOutput<CliCommandOutputs['memory search']>> {
    return this.options.cli.run('memory search', args(signal));
  }

  /** `memory search --status <status>`: the archived elements, called lazily (spec-001 §3). */
  archivedElements(
    status: ArchivedStatus,
    signal?: AbortSignal,
  ): Promise<CliOutput<CliCommandOutputs['memory search']>> {
    return this.options.cli.run('memory search', { ...args(signal), options: { '--status': status } });
  }

  /** `memory history <id>`. */
  history(id: string, signal?: AbortSignal): Promise<CliOutput<CliCommandOutputs['memory history']>> {
    return this.options.cli.run('memory history', { ...args(signal), positionals: [id] });
  }

  /** The type definitions: the direct read of `.wingfoil/memory.yaml` (spec-001 §4.1). */
  memoryTypes(): Promise<MemoryYaml> {
    return readMemoryYaml(this.options.root, this.fs);
  }

  /** The file of a `memory search` match, cross-checked with it (spec-001 §4.2). */
  elementFromMatch(match: MemoryMatch): Promise<ElementContent> {
    return readElement(this.options.root, match, this.fs);
  }

  /**
   * The element `id`: looked up in `memory search`, then in the archived lists; `undefined` when
   * the CLI lists no element with that id.
   */
  async element(id: string, signal?: AbortSignal): Promise<ElementRead | undefined> {
    let match = (await this.elements(signal)).data.matches.find((m) => m.id === id);
    for (const status of ARCHIVED_STATES) {
      match ??= (await this.archivedElements(status, signal)).data.matches.find((m) => m.id === id);
    }
    return match ? { match, content: await this.elementFromMatch(match) } : undefined;
  }

  /** The file of a `directives list` entry (spec-001 §4.3). */
  directiveFromEntry(entry: DirectiveEntry): Promise<DirectiveContent> {
    return readDirective(this.options.root, entry, this.fs);
  }

  /**
   * The directive `id`, looked up in `directives list`; `undefined` when none has that id. When
   * several files declare the id, the CLI lists them all and its warning names the one in force
   * (`directive '<id>' defined in <a>, <b>; using <path>`): that entry is read, else the last one
   * listed (the custom one, listed after the built-in).
   */
  async directive(id: string, signal?: AbortSignal): Promise<DirectiveRead | undefined> {
    const { entries, warnings } = (await this.directives(signal)).data;
    const candidates = entries.filter((e) => e.frontmatter.id === id);
    const inForce = warnings
      .map((w) => /^directive '(.*)' defined in .*; using (\S+)$/.exec(w))
      .find((m) => m?.[1] === id)?.[2];
    const entry = candidates.find((e) => e.path === inForce) ?? candidates.at(-1);
    return entry ? { entry, content: await this.directiveFromEntry(entry) } : undefined;
  }
}

function args(signal: AbortSignal | undefined): CliArgs {
  return signal ? { signal } : {};
}
