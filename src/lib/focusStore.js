/** v27 Focus mode state. New key only. Timer uses timestamps (endAt), never tick counting. */
export const FOCUS_KEY = 'manuel-os-focus-v1';

export function loadFocus() {
  try {
    const f = JSON.parse(localStorage.getItem(FOCUS_KEY) || 'null');
    if (f && typeof f.id === 'string') return f;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveFocus(f) {
  try {
    if (f) localStorage.setItem(FOCUS_KEY, JSON.stringify(f));
    else localStorage.removeItem(FOCUS_KEY);
  } catch {
    /* ignore */
  }
}
