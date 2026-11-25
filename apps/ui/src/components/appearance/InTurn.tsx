import { useEffect, useState, type ReactNode } from "react";

/**
 * Heavy parts drawn one after another, a moment apart, so the page answers at once instead of standing
 * still until all of them are drawn. Each keeps its own state: one appearing does not re-draw the others.
 */
const waiting: (() => void)[] = [];
let busy = false;

function next() {
  const draw = waiting.shift();
  if (!draw) {
    busy = false;
    return;
  }
  draw();
  later();
}

/** After the screen has shown what was drawn. */
function later() {
  busy = true;
  requestAnimationFrame(() => setTimeout(next, 0));
}

export function InTurn({ children, placeholder }: { children: ReactNode; placeholder: ReactNode }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const draw = () => setDrawn(true);
    waiting.push(draw);
    if (!busy) later();
    return () => {
      const at = waiting.indexOf(draw);
      if (at >= 0) waiting.splice(at, 1);
    };
  }, []);
  return drawn ? children : placeholder;
}
