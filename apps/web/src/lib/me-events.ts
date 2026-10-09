/**
 * Connection-state invalidation bus.
 *
 * `/me` is read once per screen mount. When the user severs a connection
 * elsewhere — the topbar's Disconnect X, for example — every open screen
 * holding that snapshot goes stale (Bug 2a: settings kept reporting
 * "connected" until a manual refresh). Call `notifyMeChanged()` after any
 * connect/disconnect mutation; screens subscribed via `onMeChanged`
 * re-read `/me` through their existing `reload()`.
 *
 * Module-scope on purpose: it carries no data, only a generation signal,
 * so there is nothing to persist, serialize, or leak across users.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyMeChanged(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // One screen's reload must never break the others. Each reload maps
      // its own failure to an error state; the bus itself stays silent.
    }
  }
}

/** Subscribe a reload. Returns the unsubscribe function for effects. */
export function onMeChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
