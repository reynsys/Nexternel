import assert from "node:assert/strict";
import test from "node:test";
import { stripColours, tidyJobLog } from "./esphome-jobs.js";

test("colour codes are removed, written out or real", () => {
  assert.equal(stripColours("\\033[32mINFO ok\\033[0m"), "INFO ok");
  assert.equal(stripColours("\x1b[31mERROR no\x1b[0m"), "ERROR no");
});

test("progress lines for the same thing are shortened to the last one", () => {
  const log = [
    "INFO Compiling",
    "Downloading PlatformIO packages: [          ] 0%",
    "Downloading PlatformIO packages: [=         ] 10%",
    "Downloading PlatformIO packages: [==========] 100%",
    "Unpacking 0% 10% 20%",
    "Unpacking 0% 10% 20% 30% 100%",
    "INFO Done 100%",
    "INFO Linking",
  ].join("\n");
  assert.equal(
    tidyJobLog(log),
    ["INFO Compiling", "Downloading PlatformIO packages: [==========] 100%", "Unpacking 0% 10% 20% 30% 100%", "INFO Done 100%", "INFO Linking"].join("\n")
  );
});
