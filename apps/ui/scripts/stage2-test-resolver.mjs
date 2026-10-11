import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), "../../..");
const domainEntry = join(repoRoot, "packages/domain/dist/index.js");

const TSX_STUB_URL =
  "data:text/javascript,export default null;export function useDashboardTileChrome(){return{}};export const DashboardTileContext={};export const __esModule=true;";

function stubTsxIfNeeded(filePath) {
  if (filePath.endsWith(".tsx")) {
    return { url: TSX_STUB_URL, shortCircuit: true };
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@nexternel/domain") {
    return { url: pathToFileURL(domainEntry).href, shortCircuit: true };
  }

  if (!context.parentURL) {
    return nextResolve(specifier, context);
  }

  const parent = fileURLToPath(context.parentURL);
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const base = resolvePath(dirname(parent), specifier);
    const stem = base.endsWith(".js") ? base.slice(0, -3) : base;
    const candidates = [`${stem}.ts`, `${stem}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
    if (existsSync(base)) {
      try {
        if (statSync(base).isDirectory()) {
          candidates.unshift(join(base, "index.ts"), join(base, "index.tsx"));
        } else {
          candidates.unshift(base);
        }
      } catch {
        /* ignore */
      }
    }
    for (const candidate of candidates) {
      if (existsSync(candidate) && !statSync(candidate).isDirectory()) {
        const tsxStub = stubTsxIfNeeded(candidate);
        if (tsxStub) return tsxStub;
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }

  return nextResolve(specifier, context);
}
