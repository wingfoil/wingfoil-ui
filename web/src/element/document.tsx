/**
 * The element's summary and document (task-078; US-G-03, RP3-7 N6; ux-reference §4.2 v0.3;
 * D78-2 … D78-8), loaded on first use with markdown-it, as the Documentation and Directives views
 * are: the summary — the body's first paragraph rendered as Markdown — and *Open document*, a modal
 * dialog with the whole body *Rendered* (default) or as its *Source*. Shown by the element page and
 * the side panel alike (`ElementContent`).
 *
 * Rendering is the Documentation view's (`docs/render.ts`, adr-002: markdown-it with raw HTML shown
 * as text, DOMPurify last; `docs/links.ts`): relative links resolve against the element file's
 * folder, a Memory file opens its element page, an indexed document the Documentation view,
 * `http(s)` a new tab; images are never loaded. HTML comments are left out of the rendered summary
 * and document and kept in *Source* (the approver's Q2 (b)); heading ids are `eldoc-` (D78-5). The
 * body is document content shown as written (D56-2); the title is the server's escaped text (K1).
 */
import type { ElementDetail } from '@wingfoil-ui/contracts';
import { useRouter } from '@tanstack/react-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { useLinkLookup } from '../docs/link-lookup.js';
import { classifyLink, resolveLink, type LinkLookup } from '../docs/links.js';
import { RenderedArticle, useRenderTexts } from '../docs/RenderedArticle.js';
import { documentHref, finishDocument, markdownToSafeHtml, type FinishOptions } from '../docs/render.js';
import { summaryHtml } from './summary.js';
import '../docs/docs.css';

/** The heading ids of an element's document (D78-5). */
const PREFIX = 'eldoc-';
const RENDERED = 'rendered';
const SOURCE = 'source';

/** While the lookup is loading every repository link waits. */
const WAITING: LinkLookup = { documents: new Set(), elements: undefined, probes: new Map() };

/** Props of {@link ElementDocument}. */
export interface ElementDocumentProps {
  pid: string;
  detail: ElementDetail;
}

/** The summary and the document dialog of an element. */
export function ElementDocument({ pid, detail }: ElementDocumentProps): ReactNode {
  const intl = useIntl();
  const router = useRouter();
  const texts = useRenderTexts();
  const { body } = detail;
  const path = detail.element.path;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<string>(RENDERED);
  /** The heading the dialog opens on (an anchor of the summary), else `''`. */
  const [target, setTarget] = useState('');
  const empty = body.trim() === '';

  const documentHtml = useMemo(() => (empty ? '' : markdownToSafeHtml(body, { comments: 'drop' })), [body, empty]);
  const summary = useMemo(() => summaryHtml(body) ?? '', [body]);
  // One lookup for the whole body (the summary's links are some of them): nothing is read when no
  // link names a repository path (D78-6).
  const lookup = useLinkLookup(pid, path, documentHtml, { onlyWithRepositoryLinks: true });
  const options = useMemo<FinishOptions>(() => {
    const current = lookup ?? WAITING;
    return {
      pid,
      documentPath: path,
      classify: (href) => classifyLink(resolveLink(href, path), current),
      // An anchor of the element's own file stays in the article (`#fragment`, D78-5); another
      // document opens in the Documentation view.
      hrefOf: (to, fragment) => (to === path ? `#${encodeURIComponent(fragment)}` : documentHref(pid, to, fragment)),
      headingPrefix: PREFIX,
      ...texts,
    };
  }, [pid, path, lookup, texts]);
  const finishedSummary = useMemo(() => (summary === '' ? '' : finishDocument(summary, options)), [summary, options]);
  const finishedDocument = useMemo(
    () => (documentHtml === '' ? '' : finishDocument(documentHtml, options)),
    [documentHtml, options],
  );

  // A link selected inside the summary or the dialog navigates (the dialog goes with the old
  // address; from the side panel the address loses `panel=`, G-03.4).
  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      void router.navigate({ href });
    },
    [router],
  );
  const hrefOfAnchor = useCallback((fragment: string) => `#${encodeURIComponent(fragment)}`, []);
  const openOn = useCallback((fragment: string) => {
    setMode(RENDERED);
    setTarget(fragment);
    setOpen(true);
  }, []);

  return (
    <>
      {finishedSummary === '' ? (
        <p className="element-summary">
          <FormattedMessage id="element.summary.none" />
        </p>
      ) : (
        <RenderedArticle
          as="div"
          className="element-summary"
          html={finishedSummary}
          focusOnShow={false}
          headingPrefix={PREFIX}
          onAnchor={openOn}
          pageKey={detail.element.id}
          hash=""
          hrefOf={hrefOfAnchor}
          onNavigate={navigate}
        />
      )}
      <DialogTrigger
        isOpen={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTarget('');
        }}
      >
        <Button className="button element-document-open">
          <FormattedMessage id="element.document.open" />
        </Button>
        <ModalOverlay className="modal-overlay">
          <Modal className="modal element-document-modal">
            <Dialog className="dialog element-document">
              {({ close }) => (
                <>
                  <div className="dialog-header">
                    <Heading slot="title" className="dialog-title">
                      {detail.element.title}
                    </Heading>
                    <Button className="button button-quiet" onPress={close}>
                      <FormattedMessage id="common.action.close" />
                    </Button>
                  </div>
                  <ToggleButtonGroup
                    className="segmented element-document-mode"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[mode]}
                    onSelectionChange={(keys) => {
                      const [next] = [...keys];
                      if (typeof next === 'string') setMode(next);
                    }}
                    aria-label={intl.formatMessage({ id: 'element.document.view' })}
                  >
                    <ToggleButton id={RENDERED} className="segmented-option">
                      <FormattedMessage id="element.document.rendered" />
                    </ToggleButton>
                    <ToggleButton id={SOURCE} className="segmented-option">
                      <FormattedMessage id="element.document.source" />
                    </ToggleButton>
                  </ToggleButtonGroup>
                  {empty ? (
                    <p className="muted">
                      <FormattedMessage id="element.document.empty" />
                    </p>
                  ) : mode === SOURCE ? (
                    // The body as written (comments included), as React text: nothing is interpreted.
                    <pre
                      className="element-document-source"
                      role="region"
                      tabIndex={0}
                      aria-label={intl.formatMessage({ id: 'element.document.source' })}
                    >
                      {body}
                    </pre>
                  ) : (
                    <RenderedArticle
                      className="element-document-body"
                      html={finishedDocument}
                      label={detail.element.title}
                      focusOnShow={false}
                      headingPrefix={PREFIX}
                      onAnchor="focus"
                      pageKey={detail.element.id}
                      hash={target}
                      hrefOf={hrefOfAnchor}
                      onNavigate={navigate}
                    />
                  )}
                </>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </>
  );
}

export default ElementDocument;
