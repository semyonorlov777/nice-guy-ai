"use client";

import { useState, useEffect } from "react";

export function useCountUp(target: number, duration = 1500, delay = 400): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      function tick(now: number) {
        const progress = Math.min((now - start) / duration, 1);
        setValue(Math.floor(progress * target));
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          setValue(target);
        }
      }
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);

  return value;
}
