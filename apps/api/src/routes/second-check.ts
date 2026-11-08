import type { FastifyPluginAsync } from "fastify";
import QRCode from "qrcode";
import { getPool } from "../db.js";
import { requireUser } from "../auth/plugin.js";
import { requirePermission } from "../auth/rbac.js";
import { verifyPassword } from "../auth/tokens.js";
import { isFromHome } from "../auth/login-guard.js";
import {
  checkSignInCode,
  confirmSetup,
  listTrustedScreens,
  removeTrustedScreen,
  secondCheckState,
  startSetup,
  turnOff,
} from "../auth/second-check.js";
import { groupKey, otpauthUrl } from "../auth/totp.js";

/** My profile → Second check, and the administrator's "Turn off second check" in Users. */
export const secondCheckRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/auth/second-check", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const id = request.user!.id;
    return { state: await secondCheckState(id), trusted: await listTrustedScreens(id) };
  });

  /** A new key for the Authenticator app: the link (phone), the QR code (other screens) and the key typed by hand. */
  app.post("/api/v1/auth/second-check/start", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const secret = await startSetup(request.user!.id);
    const link = otpauthUrl(secret, request.user!.username);
    const qrSvg = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return { key: groupKey(secret), accountName: `Nexternel – ${request.user!.username}`, link, qrSvg };
  });

  app.post<{ Body: { code?: string } }>(
    "/api/v1/auth/second-check/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!requireUser(request, reply)) return;
      const ok = await confirmSetup(request.user!.id, String(request.body?.code ?? ""));
      if (!ok) {
        return reply.code(400).send({
          error: { code: "wrong_code", message: "That code is not right. Check that the app shows Nexternel and type the newest code." },
        });
      }
      request.log.info({ username: request.user!.username }, "second check turned on");
      return { ok: true };
    }
  );

  /** Turn it off: the password again, and from outside also a code (a borrowed screen alone is not enough). */
  app.post<{ Body: { password?: string; code?: string } }>(
    "/api/v1/auth/second-check/off",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!requireUser(request, reply)) return;
      const id = request.user!.id;
      const res = await getPool().query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [id]);
      const hash = res.rows[0]?.password_hash;
      if (!hash || !(await verifyPassword(String(request.body?.password ?? ""), hash))) {
        return reply.code(400).send({ error: { code: "wrong_password", message: "That password is not right." } });
      }
      if (!isFromHome(request) && (await secondCheckState(id)) === "on") {
        if (!(await checkSignInCode(id, String(request.body?.code ?? "")))) {
          return reply.code(400).send({
            error: { code: "wrong_code", message: "From outside the home, also type the code from the app." },
          });
        }
      }
      await turnOff(id);
      request.log.info({ username: request.user!.username }, "second check turned off");
      return { ok: true };
    }
  );

  app.delete<{ Params: { id: string } }>("/api/v1/auth/second-check/trusted/:id", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    await removeTrustedScreen(request.user!.id, request.params.id);
    return { ok: true };
  });

  /** For someone who lost their phone: the home's administrator turns their second check off. */
  app.post<{ Params: { id: string } }>("/api/v1/users/:id/second-check-off", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    await turnOff(request.params.id);
    request.log.info({ userId: request.params.id, by: request.user!.username }, "second check turned off by administrator");
    return { ok: true };
  });
};
