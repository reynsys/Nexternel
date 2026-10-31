import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/*
 * A switch's label says what the switch does when it is on, and never changes with it. A label that
 * flips with the switch ("Shown" / "Hidden") reads like a second setting: a switch that is off next
 * to the word "Hidden" looks like "Hidden is not selected".
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "local" ? [] : files(p);
    return p.endsWith(".tsx") && !p.endsWith(".test.tsx") ? [p] : [];
  });
}

const tagOf = (n: ts.Node): string | null =>
  ts.isJsxElement(n) ? n.openingElement.tagName.getText() : ts.isJsxSelfClosingElement(n) ? n.tagName.getText() : null;

const attributesOf = (n: ts.Node): ts.JsxAttributes | null =>
  ts.isJsxElement(n) ? n.openingElement.attributes : ts.isJsxSelfClosingElement(n) ? n.attributes : null;

test("switch labels stay the same when the switch is turned on or off", () => {
  const problems: string[] = [];
  for (const file of files(SRC)) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (tagOf(node) === "FormControlLabel") {
        const attrs = attributesOf(node)?.properties ?? ts.factory.createNodeArray();
        const attr = (name: string) =>
          attrs.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === name);
        const control = attr("control")?.initializer?.getText() ?? "";
        const label = attr("label")?.initializer;
        if (
          /<Switch\b/.test(control) &&
          label &&
          ts.isJsxExpression(label) &&
          label.expression &&
          ts.isConditionalExpression(label.expression)
        ) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart());
          problems.push(`${relative(SRC, file)}:${line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(problems, [], "A switch's label must not change with the switch (say what 'on' does instead)");
});
