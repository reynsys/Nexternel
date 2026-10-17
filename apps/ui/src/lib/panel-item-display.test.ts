import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ITEM_DISPLAY,
  readPanelItemDisplay,
  resolveItemHeading,
  writePanelItemDisplay,
} from "./panel-item-display.ts";

const base = { itemId: "co2", title: "Hallway Monitor CO2", readingIcon: "auto", prefix: "Hallway Monitor" };

test("by default an item shows its short name and the reading's icon", () => {
  assert.deepEqual(resolveItemHeading({ ...base, display: DEFAULT_ITEM_DISPLAY }), { name: "CO2", iconId: "auto" });
  assert.deepEqual(
    resolveItemHeading({ ...base, readingIcon: "air", display: DEFAULT_ITEM_DISPLAY }),
    { name: "CO2", iconId: "air" }
  );
});

test("Full names keep the device name; Hidden names and icons show nothing", () => {
  const full = resolveItemHeading({ ...base, display: { ...DEFAULT_ITEM_DISPLAY, names: "full" } });
  assert.equal(full.name, "Hallway Monitor CO2");
  const hidden = resolveItemHeading({ ...base, display: { icons: "hide", names: "hide", overrides: {} } });
  assert.deepEqual(hidden, { name: null, iconId: null });
});

test("this panel's own name and icon win; 'none' removes the icon on this panel only", () => {
  const display = { ...DEFAULT_ITEM_DISPLAY, overrides: { co2: { name: "Air quality", icon: "masks" } } };
  assert.deepEqual(resolveItemHeading({ ...base, display }), { name: "Air quality", iconId: "masks" });
  const noIcon = { ...DEFAULT_ITEM_DISPLAY, overrides: { co2: { icon: "none" } } };
  assert.deepEqual(resolveItemHeading({ ...base, display: noIcon }), { name: "CO2", iconId: null });
});

test("saved panels without these settings are unchanged, and leftovers for removed items are dropped", () => {
  assert.deepEqual(readPanelItemDisplay({}), DEFAULT_ITEM_DISPLAY);
  assert.deepEqual(writePanelItemDisplay({ clockFace: "digital" }, DEFAULT_ITEM_DISPLAY), { clockFace: "digital" });
  const saved = writePanelItemDisplay(
    { itemIcons: "hide" },
    { icons: "show", names: "full", overrides: { a: { name: "A" }, gone: { icon: "star" }, empty: {} } },
    ["a", "empty"]
  );
  assert.deepEqual(saved, { itemNames: "full", itemOverrides: { a: { name: "A" } } });
  assert.deepEqual(readPanelItemDisplay(saved), { icons: "show", names: "full", overrides: { a: { name: "A" } } });
});

test("a switch's own style in the panel is read and saved; an unknown one is dropped", () => {
  const read = readPanelItemDisplay({ itemOverrides: { a: { switchStyle: "gears" }, b: { switchStyle: "bear" } } });
  assert.deepEqual(read.overrides, { a: { switchStyle: "gears" } });
  const saved = writePanelItemDisplay({}, read);
  assert.deepEqual(saved.itemOverrides, { a: { switchStyle: "gears" } });
});
