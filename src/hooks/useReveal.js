import { useEffect, useRef } from 'react';

// Fades `.reveal` elements inside the returned ref up into view the first
// time they scroll onto the screen. Elements only start hidden once this
// runs (the root gets `reveal-ready`), so nothing stays invisible without JS.
// Pass values that change the number of `.reveal` elements as `deps`.
export default function useReveal(deps = []) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const pending = [...root.querySelectorAll('.reveal:not(.is-revealed)')];
    if (!('IntersectionObserver' in window)) {
      pending.forEach((element) => element.classList.add('is-revealed'));
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        // Once shown, hand the element back to its normal styles (and hover
        // transitions) so the reveal's slower timing doesn't linger.
        entry.target.addEventListener('transitionend', () => {
          entry.target.classList.remove('reveal', 'is-revealed');
        }, { once: true });
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    pending.forEach((element) => observer.observe(element));
    root.classList.add('reveal-ready');
    return () => observer.disconnect();
  }, deps);

  return rootRef;
}
