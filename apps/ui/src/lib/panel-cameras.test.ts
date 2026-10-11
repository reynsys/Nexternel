import assert from "node:assert/strict";
import test from "node:test";
import type { CameraRecord } from "../api.ts";
import { decodePanelInstance } from "./panel-compatibility/normalize-panel.ts";
import { panelHeading } from "./panel-heading.ts";
import { visiblePanelCameras } from "./panel-cameras.ts";

const cam = (id: string, name: string, areaId: string, areaName: string, sortOrder: number) =>
  ({ id, name, areaId, areaName, enabled: true, sortOrder }) as CameraRecord;
// The live cameras on 10/10/2026.
const driveway = cam("drive", "Driveway", "a-drive", "Driveway", 1);
const front = cam("front", "Front Garden", "a-garden", "Garden", 2);
const back = cam("back", "Back Garden", "a-garden", "Garden", 3);
const all = [back, driveway, front];

function cameraPanel(config: Record<string, unknown>, title?: string) {
  return decodePanelInstance({
    id: "c", type: "panel.camera", title,
    layout: { i: "c", x: 0, y: 0, w: 12, h: 4 }, bindings: {}, config,
  });
}

test("picked cameras are shown even when an area is also set", () => {
  const shown = visiblePanelCameras(all, { areaIds: ["a-drive"], contentMode: "manual", cameraIds: ["front", "drive", "back"] });
  assert.deepEqual(shown.map((c) => c.id), ["front", "drive", "back"]);
});

test("automatic camera panels follow area, then camera order", () => {
  assert.deepEqual(visiblePanelCameras(all, { areaIds: [], contentMode: "auto", cameraIds: [] }).map((c) => c.id), ["drive", "front", "back"]);
  assert.deepEqual(visiblePanelCameras(all, { areaIds: ["a-garden"], contentMode: "auto", cameraIds: [] }).map((c) => c.id), ["front", "back"]);
});

test("one camera names the title strip; the tile shows only video", () => {
  const panel = cameraPanel({ panelScope: { contentMode: "manual", cameraIds: ["drive"] } }, "Cameras");
  const heading = panelHeading(panel, [], null, all);
  assert.equal(heading.title, "Cameras");
  assert.equal(heading.area, "Driveway");
  assert.equal(heading.ownsItemName, true);
});

test("one camera without a title uses the camera name", () => {
  const panel = cameraPanel({ panelScope: { contentMode: "manual", cameraIds: ["front"] } });
  const heading = panelHeading(panel, [], null, all);
  assert.equal(heading.title, "Front Garden");
  assert.equal(heading.area, "Garden");
});

test("several cameras in one area share it in the title strip", () => {
  const panel = cameraPanel({ panelScope: { contentMode: "manual", cameraIds: ["front", "back"] } });
  const heading = panelHeading(panel, [], null, all);
  assert.equal(heading.title, "Garden");
  assert.equal(heading.area, null);
  assert.equal(heading.ownsItemName, false);
});

test("several cameras in different areas fall back to the title or Cameras", () => {
  const panel = cameraPanel({ panelScope: { contentMode: "manual", cameraIds: ["drive", "front", "back"] } }, "Cameras");
  const heading = panelHeading(panel, [], null, all);
  assert.equal(heading.title, "Cameras");
  assert.equal(heading.area, null);
});
