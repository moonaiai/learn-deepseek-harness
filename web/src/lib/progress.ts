/**
 * Client-only reading-progress tracking. Completed chapter ids are kept in
 * localStorage as a JSON array; there is no server component, so every
 * function here is safe to call only from the browser (guarded by a
 * `typeof window` check for safety during any accidental server import).
 */

const STORAGE_KEY = "ldh:progress:v1";

function readRaw(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // Corrupt or inaccessible storage: treat as no progress rather than throwing.
    return [];
  }
}

function writeRaw(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function getCompletedIds(): Set<string> {
  return new Set(readRaw());
}

export function isCompleted(id: string): boolean {
  return getCompletedIds().has(id);
}

export function setCompleted(id: string, completed: boolean): Set<string> {
  const ids = getCompletedIds();
  if (completed) ids.add(id);
  else ids.delete(id);
  writeRaw([...ids]);
  return ids;
}

export function toggleCompleted(id: string): Set<string> {
  return setCompleted(id, !isCompleted(id));
}

export const PROGRESS_EVENT = "ldh:progress-changed";

/** Components that render progress state should re-read it on this event,
 * since localStorage writes from another component in the same tab do not
 * fire the native `storage` event. */
export function notifyProgressChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}
