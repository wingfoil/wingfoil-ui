/**
 * The event bus port (adr-002) and its in-process adapter: change notifications published by the
 * server's domain (the repository watcher, writes, the project list) and delivered to every open
 * event stream (`GET /api/events`, spec-004 §6).
 */
import type { ServerEvent } from '@wingfoil-ui/contracts';

/** A subscriber: called synchronously for every event published after it subscribed. */
export type EventListener = (event: ServerEvent) => void;

/** The port. */
export interface EventBus {
  /** Deliver `event` to every subscriber. */
  publish(event: ServerEvent): void;
  /** Subscribe; the returned function unsubscribes (idempotent). */
  subscribe(listener: EventListener): () => void;
}

/** The in-process adapter: a set of listeners; a failing listener does not stop the others. */
export class InProcessEventBus implements EventBus {
  private readonly listeners = new Set<EventListener>();

  /** Number of subscribers. */
  get size(): number {
    return this.listeners.size;
  }

  publish(event: ServerEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // A subscriber's failure (e.g. a stream closing) is its own; the others still get the event.
      }
    }
  }

  subscribe(listener: EventListener): () => void {
    // A wrapper per subscription: the same function subscribed twice is two subscribers.
    const entry: EventListener = (event) => listener(event);
    this.listeners.add(entry);
    return () => {
      this.listeners.delete(entry);
    };
  }
}
