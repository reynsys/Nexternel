import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "../version";

/*
 * The screen and the server part carry the same version. Settings → System → Updates compares the
 * newest release with the server's version, so a release that raises only one keeps offering itself.
 */
const API_VERSION_FILE = join(dirname(fileURLToPath(import.meta.url)), "../../../api/src/version.ts");

test("the screen and the server part have the same version", () => {
  const src = readFileSync(API_VERSION_FILE, "utf8");
  const part = (name: string) => src.match(new RegExp(`${name} = (\\d+);`))?.[1];
  const api = `V${part("VERSION_GENERATION")}.${part("VERSION_HARDWARE")}.${part("VERSION_SOFTWARE")}`;
  assert.equal(api, APP_VERSION, `apps/api/src/version.ts says ${api}, apps/ui/src/version.ts says ${APP_VERSION}`);
});
