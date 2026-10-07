import { flushSync } from 'react-dom';

// Runs a React state update inside a View Transition, so elements that have
// a `view-transition-name` animate between their old and new places.
// Browsers without the API, and people who prefer reduced motion, just get
// the update straight away. `rootClass` is put on <html> while the
// transition runs so CSS can tune that kind of transition.
export function withViewTransition(update, { rootClass } = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduceMotion) {
    update();
    return;
  }
  const root = document.documentElement;
  if (rootClass) root.classList.add(rootClass);
  const transition = document.startViewTransition(() => flushSync(update));
  if (rootClass) transition.finished.finally(() => root.classList.remove(rootClass));
}

// view-transition-name must be a valid CSS identifier.
export function transitionName(prefix, id) {
  return `${prefix}-${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
