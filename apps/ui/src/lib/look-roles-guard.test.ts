import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Every screen takes its colours, borders, shadows and corners from the chosen Look's roles
 * (skins/look-theme.ts, theme.nx, choiceSx / sectionSx in skins/surfaceStyles.ts), so a Look restyles
 * all of Nexternel at once. A fixed colour or pixel corner written into a screen would not follow.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXED = /(bgcolor|backgroundColor|borderColor|boxShadow|border|background):\s*"[^"]*#[0-9a-fA-F]{3,8}|borderRadius:\s*"[0-9.]+px/g;
/** A box drawn by hand with its own border: use <Paper variant="inset">, insetSx(), a Card, or another role. */
const HAND_DRAWN_BOX = /\bborder:\s*(1\b|"1px solid")/g;
/** A button styled where it is used: buttons take their look from the Look's button roles. */
const BUTTON_STYLED_ON_THE_SPOT = /<(Button|IconButton)\b[^>]*?\bsx=\{\{[^}]*?\b(bgcolor|backgroundColor|border|borderColor|borderRadius|boxShadow)\b/gs;
/** Allowed: the status lights' own traffic-light shapes, and the chart test page. */
const ALLOWED = new Set(["components/status-light/StatusLight.tsx", "echarts-lab.tsx"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "local" ? [] : files(p);
    if (/\.test\.tsx?$/.test(p)) return [];
    // Screens (.tsx), and the style files screens share (.ts in pages, components, panels, widgets).
    if (p.endsWith(".tsx")) return [p];
    return p.endsWith(".ts") && /[\\/](pages|components|panels|widgets)[\\/]/.test(p) ? [p] : [];
  });
}

test("screens use the Look's roles: no fixed colours, pixel corners, hand-drawn boxes or buttons styled on the spot", () => {
  const found: string[] = [];
  for (const file of files(SRC)) {
    const rel = relative(SRC, file).replace(/\\/g, "/");
    if (ALLOWED.has(rel)) continue;
    const text = readFileSync(file, "utf8");
    for (const m of [...text.matchAll(FIXED), ...text.matchAll(HAND_DRAWN_BOX), ...text.matchAll(BUTTON_STYLED_ON_THE_SPOT)]) {
      const line = text.slice(0, m.index).split("\n").length;
      found.push(`${rel}:${line}  ${m[0]}`);
    }
  }
  assert.deepEqual(found, [], `Use the Look's roles (theme.nx, choiceSx, sectionSx) instead of:\n${found.join("\n")}`);
});
