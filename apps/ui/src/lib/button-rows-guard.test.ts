import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/*
 * Buttons that sit together keep Nexternel's space between buttons (--nx-control-gap: the Look's
 * controlGap plus room for its button decoration). So every element holding two or more buttons
 * side by side is one that applies it: <ButtonRow>, dialog/card actions, or a joined group.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUTTONS = new Set(["Button", "IconButton", "LoadingButton"]);
const SPACED = new Set(["ButtonRow", "DialogActions", "CardActions", "ToggleButtonGroup", "ButtonGroup"]);
/** Holders whose buttons are not side by side (separate blocks of a dialog, steps, table rows), or a toolbar with its own wider gap. */
const NOT_A_ROW = new Set(["DialogContent", "StepContent", "TableBody", "Collapse", "Box", "Toolbar"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "local" ? [] : files(p);
    return p.endsWith(".tsx") && !p.endsWith(".test.tsx") ? [p] : [];
  });
}

const tagOf = (n: ts.Node): string | null =>
  ts.isJsxElement(n) ? n.openingElement.tagName.getText() : ts.isJsxSelfClosingElement(n) ? n.tagName.getText() : null;

/**
 * How many buttons a child adds side by side: a button (also inside a Tooltip) is 1. In {…} only the
 * outermost elements count (a card holding a button is not a button); one made by .map counts 2.
 */
function buttonsIn(child: ts.Node): number {
  const tag = tagOf(child);
  if (tag) {
    if (BUTTONS.has(tag)) return 1;
    return tag === "Tooltip" && ts.isJsxElement(child) && child.children.some((c) => BUTTONS.has(tagOf(c) ?? "")) ? 1 : 0;
  }
  if (!ts.isJsxExpression(child) || !child.expression) return 0;
  let count = 0;
  const visit = (x: ts.Node, mapped: boolean) => {
    if (tagOf(x)) {
      if (buttonsIn(x)) count += mapped ? 2 : 1;
      return; // do not look inside other elements
    }
    const isMap = ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === "map";
    ts.forEachChild(x, (c) => visit(c, mapped || isMap));
  };
  visit(child.expression, false);
  return count;
}

test("buttons that sit together use ButtonRow (or dialog actions), so they keep Nexternel's space between buttons", () => {
  const found: string[] = [];
  for (const file of files(SRC)) {
    const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (n: ts.Node) => {
      if (ts.isJsxElement(n)) {
        const tag = n.openingElement.tagName.getText();
        const count = n.children.reduce((a, c) => a + buttonsIn(c), 0);
        if (count >= 2 && !SPACED.has(tag) && !NOT_A_ROW.has(tag)) {
          found.push(`${relative(SRC, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} <${tag}>`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  assert.deepEqual(found, [], `Put these buttons in a <ButtonRow>:\n${found.join("\n")}`);
});
