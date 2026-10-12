import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { homeCertificatePem, httpsStatus, removeDomain, saveHttpsSettings, setDomainCertificate } from "./https.js";

export const httpsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/system/https", async (request, reply) => {
    if (!requirePermission(request, reply, "viewSystem")) return;
    return httpsStatus();
  });

  app.put<{ Body: { enabled?: boolean; extraNames?: string[] } }>("/api/v1/system/https", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const { error } = await saveHttpsSettings(request.body ?? {});
    if (error) return reply.code(400).send({ error: { code: "https_failed", message: error } });
    return httpsStatus();
  });

  /** The home certificate is public: devices download it to trust this server. */
  app.get("/api/v1/system/https/certificate", async (_request, reply) => {
    const pem = await homeCertificatePem();
    if (!pem) return reply.code(404).send({ error: { code: "not_ready", message: "The home certificate is not created yet." } });
    return reply
      .header("Content-Type", "application/x-x509-ca-cert")
      .header("Content-Disposition", 'attachment; filename="nexternel-home-certificate.crt"')
      .send(pem);
  });

  app.post("/api/v1/system/https/domain", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const files: Record<string, string> = {};
    let domain = "";
    for await (const part of request.parts({ limits: { fileSize: 200_000 } })) {
      if (part.type === "file") files[part.fieldname] = (await part.toBuffer()).toString("utf8");
      else if (part.fieldname === "domain") domain = String(part.value ?? "");
    }
    if (!files.certificate || !files.key) {
      return reply.code(400).send({ error: { code: "bad_request", message: "Choose both the certificate file and its key file." } });
    }
    const { error } = await setDomainCertificate(domain, files.certificate, files.key);
    if (error) return reply.code(400).send({ error: { code: "https_failed", message: error } });
    return httpsStatus();
  });

  app.delete("/api/v1/system/https/domain", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const { error } = await removeDomain();
    if (error) return reply.code(400).send({ error: { code: "https_failed", message: error } });
    return httpsStatus();
  });
};
