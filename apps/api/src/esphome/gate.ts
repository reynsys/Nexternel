import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { signPassToken, verifyPassToken } from "../auth/tokens.js";
import { getPool } from "../db.js";

/**
 * The ESPHome page (port 6052) is reached only through Caddy, which asks here first. Nexternel's
 * "Open in ESPHome" gives a signed-in person allowed to change devices a pass for 12 hours (a cookie
 * for this server's address, so it reaches port 6052 too); without it, the page explains how to open it.
 */
export const ESPHOME_PASS_COOKIE = "nx_esphome";
const PASS_HOURS = 12;

export const esphomeGateRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/v1/esphome/access", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const token = await signPassToken(request.user!.id, "esphome", `${PASS_HOURS}h`);
    // Not "secure": the ESPHome page is plain http on the home network even when Nexternel is https.
    reply.setCookie(ESPHOME_PASS_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: PASS_HOURS * 3600 });
    return { ok: true };
  });

  /** Caddy's question for every request to the ESPHome page: 200 lets it through. */
  app.get("/api/v1/esphome/gate", async (request, reply) => {
    const token = request.cookies?.[ESPHOME_PASS_COOKIE];
    const userId = token ? await verifyPassToken(token, "esphome") : null;
    // The person must still exist and be active (a pass ends when the account is switched off).
    const ok = userId ? (await getPool().query(`SELECT 1 FROM users WHERE id = $1 AND COALESCE(is_active, TRUE)`, [userId])).rowCount : 0;
    if (ok) return reply.code(200).send("");
    const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").replace(/:\d+$/, "");
    return reply
      .code(401)
      .type("text/html; charset=utf-8")
      .send(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ESPHome</title>` +
          `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">` +
          `<h1 style="font-size:1.4rem">Open ESPHome from Nexternel</h1>` +
          `<p>For safety, the ESPHome page opens only from Nexternel: sign in, go to <b>Devices</b>, choose a board and press <b>Open in ESPHome</b>.</p>` +
          (host ? `<p><a href="http://${host}/admin/devices">Go to Nexternel</a></p>` : "") +
          `</body>`
      );
  });
};
