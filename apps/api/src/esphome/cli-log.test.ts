import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCacheMismatch,
  esphomeCompileLogFailed,
  esphomeCompileLogSucceeded,
  esphomeCompileSucceeded,
} from "./cli-log.js";

const SUCCESS_TAIL = `
RAM:   [===       ]  27.6% (used 49960 bytes from 180736 bytes)
Flash: [=====     ]  52.0% (used 954071 bytes from 1835008 bytes)
INFO Successfully compiled program.
`;

describe("esphome cli log", () => {
  it("treats a successful ESP-IDF build as success despite esp_err object paths", () => {
    const log = `Building C object esp-idf/esp_common/src/esp_err_to_name.c.obj
${SUCCESS_TAIL}`;
    assert.equal(esphomeCompileLogSucceeded(log), true);
    assert.equal(esphomeCompileLogFailed(log), false);
    assert.equal(esphomeCompileSucceeded(log, false), true);
  });

  it("detects Failed config as failure", () => {
    const log = `Failed config\n\nsensor.scd4x: [source /config/test.yaml:46]`;
    assert.equal(esphomeCompileLogSucceeded(log), false);
    assert.equal(esphomeCompileLogFailed(log), true);
  });

  it("ignores an early ninja failure when the log ends with success", () => {
    const log = `ninja: build stopped: subcommand failed.
INFO ESPHome 2026.7.3
INFO Compiling app...
${SUCCESS_TAIL}`;
    assert.equal(esphomeCompileLogSucceeded(log), true);
    assert.equal(esphomeCompileLogFailed(log), false);
    assert.equal(esphomeCompileSucceeded(log, false), true);
  });
});

describe("buildCacheMismatch", () => {
  it("recognises build files made with the build tools in another place", () => {
    assert.equal(
      buildCacheMismatch(
        'CMake Error: The source "/root/.cache/esphome/idf/frameworks/5.5.5/components/bootloader/subproject/CMakeLists.txt" does not match the source "/config/.esphome/idf/frameworks/5.5.5/components/bootloader/subproject/CMakeLists.txt" used to generate cache.'
      ),
      true
    );
    assert.equal(
      buildCacheMismatch(
        "'/root/.cache/esphome/idf/penvs/5.5.5/bin/python' is currently active in the environment while the project was configured with '/config/.esphome/idf/penvs/5.5.5/bin/python'. Run 'idf.py fullclean' to start again."
      ),
      true
    );
    assert.equal(buildCacheMismatch("INFO Successfully compiled program."), false);
  });
});
