/**
 * The right end of the global header as a slot (task-016, W4-16): `Shell` renders the empty
 * {@link HeaderSlotTarget}; a route below it (the project layout) fills it with {@link HeaderEnd},
 * a portal, so the current user and the role view sit where the prototype puts them while their
 * component stays in the project layout — and leave with it outside a project.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Slot {
  node: HTMLElement | null;
  setNode(node: HTMLElement | null): void;
}

const SlotContext = createContext<Slot>({ node: null, setNode: () => undefined });

/** Holds the slot's element for the shell. */
export function HeaderSlotProvider({ children }: { children: ReactNode }): ReactNode {
  const [node, setNode] = useState<HTMLElement | null>(null);
  return <SlotContext.Provider value={{ node, setNode }}>{children}</SlotContext.Provider>;
}

/** The empty element of the header that {@link HeaderEnd} fills. */
export function HeaderSlotTarget(): ReactNode {
  const { setNode } = useContext(SlotContext);
  return <div className="shell-header-end" ref={setNode} />;
}

/** Render `children` at the right end of the global header (nothing until the header is mounted). */
export function HeaderEnd({ children }: { children: ReactNode }): ReactNode {
  const { node } = useContext(SlotContext);
  return node ? createPortal(children, node) : null;
}
