import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/*
 * Button wording. A button says what it does: a verb first, then what it acts on ("Update boards",
 * "Reset name", "Add device") — the way buttons read everywhere else. So a button's words:
 *  - never point at something with "it", "its", "them", "they" ("Update them once" means nothing
 *    on its own), and never say "once";
 *  - are in sentence case: only the first word starts with a capital, apart from names
 *    (Nexternel, ESPHome, Wi‑Fi…) and short forms (USB, MQTT).
 * Checked on every button's own words (also each choice in a {busy ? "Saving…" : "Save"}) and on the
 * confirm button of every question (confirmLabel).
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUTTONS = new Set(["Button", "LoadingButton"]);
const POINTING = /\b(it|its|them|they|once)\b/i;
/** Names and short forms that keep their capitals inside a button's words. */
const NAMES = new Set(["Nexternel", "ESPHome", "Shelly", "Octopus", "Wi-Fi", "Wi‑Fi", "MQTT", "USB", "CCTV", "HUD", "IP", "PIN", "Web"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "local" ? [] : files(p);
    return p.endsWith(".tsx") && !p.endsWith(".test.tsx") ? [p] : [];
  });
}

const tagOf = (n: ts.Node): string | null =>
  ts.isJsxElement(n) ? n.openingElement.tagName.getText() : null;

/** The plain words a button shows: its text, and every string it may show from {…}. */
function wordsOf(el: ts.JsxElement): string[] {
  const out: string[] = [];
  const text = el.children
    .filter(ts.isJsxText)
    .map((c) => c.getText())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text) out.push(text);
  const strings = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (!ts.isJsxElement(n) && !ts.isJsxSelfClosingElement(n) && !ts.isCallExpression(n)) ts.forEachChild(n, strings);
  };
  for (const c of el.children) if (ts.isJsxExpression(c) && c.expression) strings(c.expression);
  return out.filter((w) => /[A-Za-z]/.test(w));
}

function problem(words: string): string | null {
  if (POINTING.test(words)) return "points at something (it / its / them / they / once)";
  const rest = words.replace(/&amp;/g, "&").split(/\s+/).slice(1);
  const capital = rest.find((w) => /^[A-Z]/.test(w) && !NAMES.has(w.replace(/[^\w‑-]/g, "")) && w !== w.toUpperCase());
  return capital ? `not sentence case ("${capital}")` : null;
}

test("button words say what the button does, in sentence case, without it / them / once", () => {
  const problems: string[] = [];
  for (const file of files(SRC)) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const report = (node: ts.Node, words: string) => {
      const why = problem(words);
      if (why) problems.push(`${relative(SRC, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}  "${words}" — ${why}`);
    };
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) && BUTTONS.has(tagOf(node) ?? "")) for (const w of wordsOf(node)) report(node, w);
      if (ts.isPropertyAssignment(node) && node.name.getText() === "confirmLabel" && ts.isStringLiteral(node.initializer)) report(node, node.initializer.text);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(problems, [], "Button words: a verb and what it acts on, sentence case, no it / them / once");
});
