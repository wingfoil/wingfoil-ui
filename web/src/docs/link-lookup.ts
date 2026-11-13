/**
 * What the links of a rendered document are classified against (`docs/links.ts`; W3-30, W3-36),
 * shared by the Documentation view and, from task-078 (D78-6), an element's summary and document:
 * the docs index (`GET /docs`), the Memory elements (`GET /elements`) and the server's check of each
 * other repository target (`GET /files/content`), at most {@link MAX_LINK_CHECKS} distinct targets
 * per document (the others are "not shown in the UI"). Moved from `docs/pages.tsx` unchanged.
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { elementsQuery } from '../api/queries.js';
import { docsIndexQuery, documentContentQuery } from '../routes/docs.js';
import { useResolvedLinks } from './DocumentView.js';
import type { LinkLookup, ProbeAnswer } from './links.js';
import { refusedKind } from './QueryError.js';

/** Distinct repository targets of one document checked with the server (W3-36). */
export const MAX_LINK_CHECKS = 100;

/** Nothing to look up: a document whose links name no repository path. */
const NOTHING: LinkLookup = { documents: new Set(), elements: new Map(), probes: new Map() };

/** The server's answer for a probed path, from its content query. */
function probeAnswer(result: { data?: unknown; error: unknown }): ProbeAnswer | undefined {
  if (result.data !== undefined) return 'served';
  if (!result.error) return undefined;
  const kind = refusedKind(result.error);
  return kind === 'missing' || kind === 'outside' ? kind : 'hidden';
}

/** Options of {@link useLinkLookup}. */
export interface LinkLookupOptions {
  /**
   * Read nothing when no link of the document names a repository path (an element's body, D78-6):
   * its other links need no lookup. The Documentation view reads the index in every case.
   */
  onlyWithRepositoryLinks?: boolean;
}

/** What the links of the document at `path` are classified against (`undefined`: index loading). */
export function useLinkLookup(
  pid: string,
  path: string,
  safeHtml: string,
  options: LinkLookupOptions = {},
): LinkLookup | undefined {
  const resolved = useResolvedLinks(safeHtml, path);
  const needed = !options.onlyWithRepositoryLinks || resolved.some((target) => target.kind === 'path');
  const index = useQuery({ ...docsIndexQuery(pid), enabled: needed });
  const indexReady = index.data !== undefined || index.error !== null;
  const documents = useMemo(
    () => new Set((index.data?.documents ?? []).map((d) => d.path.normalize('NFC'))),
    [index.data],
  );
  const outsideIndex = useMemo(() => {
    const paths = new Set<string>();
    for (const target of resolved) {
      if (target.kind !== 'path') continue;
      const p = target.path.normalize('NFC');
      if (p !== '' && !documents.has(p)) paths.add(p);
    }
    return [...paths];
  }, [resolved, documents]);
  const elementsAnswer = useQuery({
    ...elementsQuery(pid, false),
    enabled: needed && indexReady && outsideIndex.length > 0,
  });
  const elements = useMemo(() => {
    if (elementsAnswer.data) return new Map(elementsAnswer.data.elements.map((e) => [e.path.normalize('NFC'), e.id]));
    // Without the elements, the Memory links are checked by the server like any path.
    return elementsAnswer.error ? new Map<string, string>() : undefined;
  }, [elementsAnswer.data, elementsAnswer.error]);
  const unknown = needed && elements ? outsideIndex.filter((p) => !elements.has(p)) : [];
  const toProbe = unknown.slice(0, MAX_LINK_CHECKS);
  const overCap = unknown.slice(MAX_LINK_CHECKS);
  const probes = useQueries({
    queries: toProbe.map((p) => documentContentQuery(pid, p)),
    combine: (results) => {
      const answers = new Map<string, ProbeAnswer>(overCap.map((p) => [p, 'hidden']));
      results.forEach((r, i) => {
        const answer = probeAnswer(r);
        if (answer) answers.set(toProbe[i]!, answer);
      });
      return answers;
    },
  });
  const probeKey = [...probes].join('|');
  return useMemo(
    () =>
      !needed
        ? NOTHING
        : !indexReady
          ? undefined
          : outsideIndex.length === 0
            ? { documents, elements: new Map(), probes: new Map() }
            : { documents, elements, probes },
    // `probes` is a new Map on every render: its content (probeKey) decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needed, indexReady, documents, elements, outsideIndex.length, probeKey],
  );
}
