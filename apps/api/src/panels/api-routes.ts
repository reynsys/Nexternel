import type { FastifyPluginAsync } from "fastify";
import {
  listUserSelectablePanels,
  listPreviewPanels,
} from "@nexternel/domain";
import { requireUser } from "../auth/plugin.js";
import {
  resolvePanelCapabilities,
  resolvePanelCapabilitiesBatch,
} from "../v4/panel-resolver.js";

export type PanelApiRoutesOptions = {
  /** API version segment — `v5` canonical, `v4` deprecated compatibility. */
  apiVersion: "v4" | "v5";
};

export function panelRegistryPayload(opts?: { preview?: boolean }) {
  const panels = opts?.preview ? listPreviewPanels() : listUserSelectablePanels();
  return {
    panels: panels.map((p) => ({
      kind: p.kind,
      label: p.label,
      description: p.description,
      supportedKinds: p.supportedKinds,
      excludeKinds: p.excludeKinds ?? [],
      userSelectable: p.userSelectable,
      previewOnly: p.previewOnly ?? false,
      sortOrder: p.sortOrder,
      defaultSize: p.defaultSize,
      scopeMode: p.scopeMode,
    })),
  };
}

export async function handleResolvePanel(
  body: {
    panelKind?: string;
    panelScope?: unknown;
    viewKind?: string;
    viewScope?: unknown;
  } | undefined
) {
  const panelKind =
    typeof body?.panelKind === "string"
      ? body.panelKind.trim()
      : typeof body?.viewKind === "string"
        ? body.viewKind.trim()
        : "";
  if (!panelKind) {
    return {
      status: 400 as const,
      body: {
        error: { code: "validation_error", message: "panelKind is required" },
      },
    };
  }
  try {
    const result = await resolvePanelCapabilities({
      panelKind,
      panelScope: body?.panelScope,
      viewKind: body?.viewKind,
      viewScope: body?.viewScope,
    });
    return { status: 200 as const, body: result };
  } catch (err) {
    return {
      status: 400 as const,
      body: {
        error: {
          code: "resolve_failed",
          message: err instanceof Error ? err.message : "Panel resolve failed",
        },
      },
    };
  }
}

/** V5 canonical Panel resolver API (`/api/v1/v5/panels/`). */
export const panelApiRoutes: FastifyPluginAsync<PanelApiRoutesOptions> = async (
  app,
  opts
) => {
  const base = `/api/v1/${opts.apiVersion}/panels`;

  app.get(`${base}/registry`, async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const q = request.query as { preview?: string };
    const preview = q.preview === "1" || q.preview === "true";
    return panelRegistryPayload({ preview });
  });

  app.post<{
    Body: {
      panelKind?: string;
      panelScope?: unknown;
      viewKind?: string;
      viewScope?: unknown;
    };
  }>(`${base}/resolve`, async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const result = await handleResolvePanel(request.body);
    return reply.code(result.status).send(result.body);
  });

  app.post<{
    Body: {
      requests?: {
        requestId?: string;
        panelKind?: string;
        panelScope?: unknown;
      }[];
    };
  }>(`${base}/resolve-batch`, async (request, reply) => {
    if (!requireUser(request, reply)) return;
    if (!Array.isArray(request.body?.requests)) {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "requests array is required",
        },
      });
    }
    const items = request.body.requests;
    const resolved = await resolvePanelCapabilitiesBatch(items);
    return {
      results: resolved.map((item, index) => ({
        requestId:
          typeof items[index]?.requestId === "string"
            ? items[index].requestId
            : String(index),
        ...item,
      })),
    };
  });
};
