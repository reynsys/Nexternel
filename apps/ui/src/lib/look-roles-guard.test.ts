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
/** Allowed: the status lights' own traffic-light shapes, and the chart test page. */
const ALLOWED = new Set(["components/status-light/StatusLight.tsx", "echarts-lab.tsx"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "local" ? [] : files(p);
    return p.endsWith(".tsx") && !p.endsWith(".test.tsx") ? [p] : [];
  });
}

test("screens use the Look's roles, not fixed colours or pixel corners", () => {
  const found: string[] = [];
  for (const file of files(SRC)) {
    const rel = relative(SRC, file).replace(/\\/g, "/");
    if (ALLOWED.has(rel)) continue;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(FIXED)) {
      const line = text.slice(0, m.index).split("\n").length;
      found.push(`${rel}:${line}  ${m[0]}`);
    }
  }
  assert.deepEqual(found, [], `Use the Look's roles (theme.nx, choiceSx, sectionSx) instead of:\n${found.join("\n")}`);
});
