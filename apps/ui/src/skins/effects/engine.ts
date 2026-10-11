/**
 * Background effects drawn on one full-screen canvas behind the app.
 *
 * Loaded only when an effect is switched on (see BackgroundEffects.tsx). Kept light for wall
 * tablets: the particle count follows the screen area, the pixel ratio is capped at 1.5, glows are
 * pre-drawn sprites, and drawing stops while the page is hidden.
 */
import type { BackgroundEffectId } from "./catalog";

export type Rgb = [number, number, number];

export type EffectOptions = {
  id: BackgroundEffectId;
  amount: number;
  speed: number;
  colours: Rgb[];
  light: boolean;
};

type Particle = {
  x: number;
  y: number;
  col: Rgb;
  ph: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
  tw: number;
  len: number;
  amp: number;
  k: number;
  w: number;
};

/** Particles for a 1100×650 screen at "Normal" amount. */
const BASE_COUNT: Record<Exclude<BackgroundEffectId, "off">, number> = {
  snow: 90,
  rain: 110,
  stars: 120,
  fireflies: 34,
  bubbles: 26,
  bokeh: 18,
  network: 60,
  "network-follow": 60,
  aurora: 3,
  waves: 5,
};

const rgba = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function startEffect(canvas: HTMLCanvasElement, initial: EffectOptions): {
  update: (opts: EffectOptions) => void;
  stop: () => void;
} {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { update: () => {}, stop: () => {} };
  const g2d = ctx;
  let opts = initial;
  let W = 0;
  let H = 0;
  let parts: Particle[] = [];
  let t = 0;
  let last = 0;
  let raf = 0;
  let stopped = false;
  const pointer = { x: -9999, y: -9999 };
  const sprites = new Map<string, HTMLCanvasElement>();

  function sprite(col: Rgb): HTMLCanvasElement {
    const key = col.join(",");
    const cached = sprites.get(key);
    if (cached) return cached;
    const s = document.createElement("canvas");
    s.width = s.height = 64;
    const g = s.getContext("2d")!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(col, 1));
    gr.addColorStop(0.35, rgba(col, 0.45));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    sprites.set(key, s);
    return s;
  }

  function spawn(initialPlacement: boolean): Particle {
    const col = opts.colours[(Math.random() * opts.colours.length) | 0] ?? [255, 255, 255];
    const p: Particle = {
      x: rnd(0, W),
      y: initialPlacement ? rnd(0, H) : -20,
      col,
      ph: rnd(0, Math.PI * 2),
      r: 2,
      vx: 0,
      vy: 0,
      a: 1,
      tw: 1,
      len: 0,
      amp: 0,
      k: 0,
      w: 0,
    };
    switch (opts.id) {
      case "snow":
        Object.assign(p, { r: rnd(1, 3.2), vy: rnd(18, 42), vx: rnd(-8, 8), a: rnd(0.35, 0.85) });
        break;
      case "rain":
        Object.assign(p, { len: rnd(10, 22), vy: rnd(380, 560), vx: -60, a: rnd(0.18, 0.4) });
        break;
      case "stars":
        Object.assign(p, { y: rnd(0, H), r: rnd(0.5, 1.8), a: rnd(0.3, 1), tw: rnd(0.6, 2.2), vx: rnd(-3, 3) });
        break;
      case "fireflies":
        Object.assign(p, { y: rnd(0, H), r: rnd(7, 15), vx: rnd(-14, 14), vy: rnd(-14, 14), tw: rnd(0.6, 1.6) });
        break;
      case "bubbles":
        Object.assign(p, { y: initialPlacement ? rnd(0, H) : H + 30, r: rnd(6, 22), vy: -rnd(16, 38), a: rnd(0.35, 0.7) });
        break;
      case "bokeh":
        Object.assign(p, { y: rnd(0, H), r: rnd(40, 110), vx: rnd(-6, 6), vy: rnd(-5, 5), a: rnd(0.1, 0.24), tw: rnd(0.2, 0.5) });
        break;
      case "network":
      case "network-follow":
        Object.assign(p, { y: rnd(0, H), vx: rnd(-22, 22), vy: rnd(-22, 22) });
        break;
      case "aurora":
      case "waves":
        Object.assign(p, { y: rnd(H * 0.25, H * 0.8), amp: rnd(20, 55), k: rnd(0.004, 0.009), w: rnd(0.25, 0.6) });
        break;
    }
    return p;
  }

  function reset() {
    cancelAnimationFrame(raf);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    // The layer is as tall as the screen can get (see .nx-page-layer), not just the window.
    const box = canvas.getBoundingClientRect();
    W = box.width || window.innerWidth;
    H = box.height || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    g2d.clearRect(0, 0, W, H);
    parts = [];
    last = 0;
    if (opts.id === "off" || stopped) return;
    const fixed = opts.id === "aurora" || opts.id === "waves";
    const areaScale = Math.max(0.35, Math.min(2.2, (W * H) / (1100 * 650)));
    const n = Math.round(BASE_COUNT[opts.id] * (fixed ? Math.min(opts.amount, 1.4) : areaScale * opts.amount));
    for (let i = 0; i < n; i++) parts.push(spawn(true));
    if (opts.id === "waves") parts.forEach((p, i) => (p.y = H * (0.45 + i * 0.1)));
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }

  function drawNetwork(dt: number) {
    const maxD2 = 120 * 120;
    const reach2 = 170 * 170;
    for (const p of parts) {
      p.x += p.vx * dt * opts.speed;
      p.y += p.vy * dt * opts.speed;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    }
    g2d.lineWidth = 1;
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i]!;
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j]!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < maxD2) {
          g2d.strokeStyle = rgba(a.col, (1 - d2 / maxD2) * (opts.light ? 0.35 : 0.28));
          g2d.beginPath();
          g2d.moveTo(a.x, a.y);
          g2d.lineTo(b.x, b.y);
          g2d.stroke();
        }
      }
      if (opts.id === "network-follow") {
        const dx = a.x - pointer.x;
        const dy = a.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach2) {
          g2d.strokeStyle = rgba(a.col, (1 - d2 / reach2) * 0.7);
          g2d.beginPath();
          g2d.moveTo(a.x, a.y);
          g2d.lineTo(pointer.x, pointer.y);
          g2d.stroke();
        }
      }
      g2d.fillStyle = rgba(a.col, opts.light ? 0.6 : 0.55);
      g2d.beginPath();
      g2d.arc(a.x, a.y, 2, 0, Math.PI * 2);
      g2d.fill();
    }
  }

  function bandY(p: Particle, x: number, i: number) {
    return (
      p.y +
      Math.sin(x * p.k + t * p.w * opts.speed + p.ph) * p.amp +
      Math.sin(x * p.k * 2.3 - t * 0.3 * opts.speed + i) * p.amp * 0.4
    );
  }

  function drawAurora() {
    g2d.globalCompositeOperation = opts.light ? "source-over" : "lighter";
    parts.forEach((p, i) => {
      const g = g2d.createLinearGradient(0, p.y - 90, 0, p.y + 90);
      g.addColorStop(0, rgba(p.col, 0));
      g.addColorStop(0.5, rgba(p.col, opts.light ? 0.16 : 0.14));
      g.addColorStop(1, rgba(p.col, 0));
      g2d.fillStyle = g;
      g2d.beginPath();
      for (let x = 0; x <= W + 20; x += 20) {
        const y = bandY(p, x, i) - 90;
        if (x === 0) g2d.moveTo(x, y);
        else g2d.lineTo(x, y);
      }
      for (let x = W + 20; x >= 0; x -= 20) g2d.lineTo(x, bandY(p, x, i) + 90);
      g2d.fill();
    });
    g2d.globalCompositeOperation = "source-over";
  }

  function drawWaves() {
    g2d.lineWidth = 1.5;
    parts.forEach((p, i) => {
      g2d.strokeStyle = rgba(p.col, opts.light ? 0.28 : 0.22);
      g2d.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const y = p.y + Math.sin(x * p.k * 0.8 + t * (0.5 + i * 0.12) * opts.speed + p.ph) * p.amp * 0.6;
        if (x === 0) g2d.moveTo(x, y);
        else g2d.lineTo(x, y);
      }
      g2d.stroke();
    });
  }

  function wrap(p: Particle, margin: number) {
    if (p.x < -margin) p.x = W + margin;
    if (p.x > W + margin) p.x = -margin;
    if (p.y < -margin) p.y = H + margin;
    if (p.y > H + margin) p.y = -margin;
  }

  function drawParticles(dt: number) {
    const sp = opts.speed;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      switch (opts.id) {
        case "snow":
          p.y += p.vy * dt * sp;
          p.x += (p.vx + Math.sin(t + p.ph) * 10) * dt * sp;
          if (p.y > H + 10) parts[i] = spawn(false);
          g2d.fillStyle = rgba(p.col, p.a);
          g2d.beginPath();
          g2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          g2d.fill();
          break;
        case "rain":
          p.y += p.vy * dt * sp;
          p.x += p.vx * dt * sp;
          if (p.y > H + 20) {
            parts[i] = spawn(false);
            parts[i]!.x = rnd(0, W + 80);
          }
          g2d.strokeStyle = rgba(p.col, p.a);
          g2d.lineWidth = 1;
          g2d.beginPath();
          g2d.moveTo(p.x, p.y);
          g2d.lineTo(p.x + p.vx * 0.03, p.y - p.len);
          g2d.stroke();
          break;
        case "stars":
          p.x += p.vx * dt * sp;
          wrap(p, 5);
          g2d.fillStyle = rgba(p.col, p.a * (0.55 + 0.45 * Math.sin(t * p.tw * sp + p.ph)));
          g2d.beginPath();
          g2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          g2d.fill();
          break;
        case "fireflies": {
          p.vx = Math.max(-18, Math.min(18, p.vx + rnd(-20, 20) * dt));
          p.vy = Math.max(-18, Math.min(18, p.vy + rnd(-20, 20) * dt));
          p.x += p.vx * dt * sp;
          p.y += p.vy * dt * sp;
          wrap(p, 20);
          g2d.globalAlpha = 0.25 + 0.75 * Math.max(0, Math.sin(t * p.tw * sp + p.ph));
          const s = p.r * 2;
          g2d.drawImage(sprite(p.col), p.x - s, p.y - s, s * 2, s * 2);
          g2d.globalAlpha = 1;
          break;
        }
        case "bubbles":
          p.y += p.vy * dt * sp;
          p.x += Math.sin(t * 0.8 + p.ph) * 12 * dt * sp;
          if (p.y < -30) parts[i] = spawn(false);
          g2d.strokeStyle = rgba(p.col, p.a);
          g2d.lineWidth = 1.2;
          g2d.fillStyle = rgba(p.col, p.a * 0.12);
          g2d.beginPath();
          g2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          g2d.fill();
          g2d.stroke();
          g2d.fillStyle = rgba([255, 255, 255], p.a * 0.6);
          g2d.beginPath();
          g2d.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.18, 0, Math.PI * 2);
          g2d.fill();
          break;
        case "bokeh":
          p.x += p.vx * dt * sp;
          p.y += p.vy * dt * sp;
          wrap(p, p.r);
          g2d.globalAlpha = p.a * (0.7 + 0.3 * Math.sin(t * p.tw * sp + p.ph));
          g2d.drawImage(sprite(p.col), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
          g2d.globalAlpha = 1;
          break;
        default:
          break;
      }
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    t += dt;
    g2d.clearRect(0, 0, W, H);
    if (opts.id === "network" || opts.id === "network-follow") drawNetwork(dt);
    else if (opts.id === "aurora") drawAurora();
    else if (opts.id === "waves") drawWaves();
    else drawParticles(dt);
  }

  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(reset, 150);
  };
  const onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else reset();
  };
  const onPointer = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  const onLeave = () => {
    pointer.x = pointer.y = -9999;
  };
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  reset();

  return {
    update(next) {
      opts = next;
      reset();
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", onLeave);
      g2d.clearRect(0, 0, W, H);
    },
  };
}
