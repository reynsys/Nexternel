import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Every blur goes through skins/glass.ts, so a moving background effect switches all of them off. */
test("no part blurs what is behind it except through the shared glass blur", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const wrong: string[] = [];
  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (!/\.(tsx?|css)$/.test(file) || file.endsWith(".test.ts") || file === path.join("skins", "glass.ts")) continue;
    readFileSync(path.join(root, file), "utf8").split("\n").forEach((line, i) => {
      if (/backdrop-?filter/i.test(line) && /(?<!GLASS_)\bblur\(/.test(line)) wrong.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(wrong, []);
});
