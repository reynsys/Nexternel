import assert from "node:assert/strict";
import test from "node:test";
import { readPanelMotion, writePanelMotion } from "./motion.ts";

test("a panel follows the Animations setting unless it chose on or off", () => {
  assert.equal(readPanelMotion({}), "follow");
  assert.equal(readPanelMotion({ appearance: { motion: "off" } }), "off");
  assert.equal(readPanelMotion({ appearance: { motion: "on" } }), "on");
  assert.equal(readPanelMotion({ appearance: { motion: "maybe" } }), "follow");
});

test("saving the choice keeps the panel's other look settings", () => {
  const saved = writePanelMotion({ appearance: { switchStyle: "gears" } }, "off");
  assert.deepEqual(saved.appearance, { switchStyle: "gears", motion: "off" });
  assert.deepEqual(writePanelMotion(saved, "follow").appearance, { switchStyle: "gears" });
  assert.equal("appearance" in writePanelMotion({}, "follow"), false);
});
