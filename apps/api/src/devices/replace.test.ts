import assert from "node:assert/strict";
import { test } from "node:test";
import { matchItems } from "./replace.js";

const item = (id: string, name: string, kind = "switch") => ({ id, name, kind });

test("items with the same kind and name move to the new device", () => {
  const { moves, missing } = matchItems(
    [item("o1", "Relay 1"), item("o2", "Relay 2"), item("o3", "Shed temperature", "temperature")],
    [item("n1", "relay 1"), item("n2", "Relay 2"), item("n3", "Shed temperature", "temperature")]
  );
  assert.deepEqual(moves.map((m) => [m.from.id, m.to.id]), [["o1", "n1"], ["o2", "n2"], ["o3", "n3"]]);
  assert.deepEqual(missing, []);
});

test("an item the new device does not have is listed as going", () => {
  const { moves, missing } = matchItems([item("o1", "Pump"), item("o2", "Fountain")], [item("n1", "Pump")]);
  assert.deepEqual(moves.map((m) => m.from.id), ["o1"]);
  assert.deepEqual(missing.map((m) => m.id), ["o2"]);
});

test("the same name with another kind is not the same item", () => {
  const { moves, missing } = matchItems([item("o1", "Shed", "temperature")], [item("n1", "Shed", "humidity")]);
  assert.equal(moves.length, 0);
  assert.equal(missing.length, 1);
});

test("each new item takes only one old one", () => {
  const { moves, missing } = matchItems([item("o1", "Relay"), item("o2", "Relay")], [item("n1", "Relay")]);
  assert.equal(moves.length, 1);
  assert.equal(missing.length, 1);
});

test("the only item of its kind on both devices moves even under another name", () => {
  const { moves, missing } = matchItems(
    [item("o1", "Hallway Monitor CO2", "co2"), item("o2", "Hallway Monitor Temperature", "temperature")],
    [item("n1", "Hallway CO2", "co2"), item("n2", "Hallway temperature", "temperature")]
  );
  assert.deepEqual(moves.map((m) => [m.from.id, m.to.id]).sort(), [["o1", "n1"], ["o2", "n2"]]);
  assert.deepEqual(missing, []);
});

test("two of a kind with other names are not guessed", () => {
  const { moves, missing } = matchItems(
    [item("o1", "Front", "temperature"), item("o2", "Back", "temperature")],
    [item("n1", "Shed", "temperature"), item("n2", "Garage", "temperature")]
  );
  assert.equal(moves.length, 0);
  assert.equal(missing.length, 2);
});

test("a name match comes first, the kind match only takes what is left", () => {
  const { moves, missing } = matchItems(
    [item("o1", "Relay 1"), item("o2", "Pump")],
    [item("n1", "Relay 1"), item("n2", "Water pump")]
  );
  assert.deepEqual(moves.map((m) => [m.from.id, m.to.id]), [["o1", "n1"], ["o2", "n2"]]);
  assert.deepEqual(missing, []);
});
