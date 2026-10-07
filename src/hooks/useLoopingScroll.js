import { useEffect, useRef, useState } from 'react';

// Measures a horizontal strip of `itemCount` cards for a continuous glide.
// When the cards are wider than the strip, `loops` turns true: the caller
// then renders the cards twice and the CSS animation slides the rail left by
// exactly one set (--loop-width) before starting over, so there is no seam.
// Pausing on hover/focus and reduced motion are handled in the CSS.
export default function useLoopingScroll(itemCount, { itemSelector = '.product-card', pixelsPerSecond = 35 } = {}) {
  const trackRef = useRef(null);
  const [setWidth, setSetWidth] = useState(0);
  const [loops, setLoops] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || itemCount === 0) return undefined;

    const measure = () => {
      const items = track.querySelectorAll(itemSelector);
      const lastItem = items[itemCount - 1];
      if (!lastItem) return;
      const gap = Number.parseFloat(window.getComputedStyle(lastItem.parentElement).columnGap) || 0;
      const width = lastItem.offsetLeft + lastItem.offsetWidth + gap - items[0].offsetLeft;
      setSetWidth(width);
      setLoops(width - gap > track.clientWidth);
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(track);
    measure();
    return () => resizeObserver.disconnect();
  }, [itemCount, itemSelector, loops]);

  const loopStyle = loops
    ? { '--loop-width': `${setWidth}px`, '--loop-duration': `${setWidth / pixelsPerSecond}s` }
    : undefined;

  return { trackRef, loops, loopStyle };
}
