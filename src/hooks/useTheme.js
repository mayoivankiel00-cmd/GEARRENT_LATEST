import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

const STORAGE_KEY = 'gearRentTheme';
const FADE_MS = 500;

function applyTheme(isLight) {
  document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
  window.localStorage.setItem(STORAGE_KEY, isLight ? 'light' : 'dark');
}

// Light/dark theme shared by the site navbar and the admin layout. Switching
// crossfades the whole page instead of swapping every color in one frame:
// with the View Transitions API where the browser has it, otherwise by
// briefly letting colors transition (.theme-fading in index.css).
export default function useTheme() {
  const [isLightTheme, setIsLightTheme] = useState(() => window.localStorage.getItem(STORAGE_KEY) === 'light');

  useEffect(() => {
    applyTheme(isLightTheme);
  }, [isLightTheme]);

  const toggleTheme = () => {
    const next = !isLightTheme;
    const swap = () => {
      applyTheme(next);
      flushSync(() => setIsLightTheme(next));
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      swap();
      return;
    }

    if (document.startViewTransition) {
      document.startViewTransition(swap);
      return;
    }

    const root = document.documentElement;
    root.classList.add('theme-fading');
    swap();
    window.setTimeout(() => root.classList.remove('theme-fading'), FADE_MS);
  };

  return { isLightTheme, toggleTheme };
}
