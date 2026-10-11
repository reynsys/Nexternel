import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./stage2-test-resolver.mjs", import.meta.url);
