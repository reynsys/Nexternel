import assert from "node:assert/strict";
import test from "node:test";
import { chosenLookFont } from "./look-font.ts";

const look = {
  fonts: [
    { id: "oxanium", label: "Oxanium", family: '"Oxanium", sans-serif' },
    { id: "exo-2", label: "Exo 2", family: '"Exo 2", sans-serif' },
  ],
};

test("a Look's font is the person's choice when offered, else its first", () => {
  assert.equal(chosenLookFont(look, "exo-2")?.id, "exo-2");
  assert.equal(chosenLookFont(look, "orbitron")?.id, "oxanium");
  assert.equal(chosenLookFont(look, undefined)?.id, "oxanium");
  assert.equal(chosenLookFont({}, "exo-2"), undefined);
});
