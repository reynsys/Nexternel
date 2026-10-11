/**
 * Test-only loader: sources import siblings as `./x.js` (NodeNext output names),
 * but tests run the `.ts` sources directly. Map a missing `.js` to its `.ts` file.
 */
import { register } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL) {
    const js = new URL(specifier, context.parentURL);
    if (!existsSync(fileURLToPath(js))) {
      const ts = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL);
      if (existsSync(fileURLToPath(ts))) return nextResolve(ts.href, context);
    }
  }
  return nextResolve(specifier, context);
}

if (!import.meta.url.includes("?hooks")) {
  register(`${import.meta.url}?hooks`);
}
