import type { ClientSnapshot } from "./buildClientSnapshot";
import type { ServerDiagnostics } from "../api";

export type AuthExtras = {
  capabilitiesCount?: number | string;
  meUsername?: string | null;
  error?: string;
};

function systemStatusLine(server: (Partial<ServerDiagnostics> & { error?: string }) | null): string {
  if (!server) return "unknown";
  if (server.error) return `error: ${server.error}`;
  return server.status === "ok" ? "OK" : "degraded";
}

export function formatDiagnosticsReport(
  client: ClientSnapshot,
  server: (Partial<ServerDiagnostics> & { error?: string }) | null,
  auth: AuthExtras | null
): string {
  const lines: string[] = [
    "# Nexternel Diagnostic Report",
    `collectedAt: ${client.collectedAt}`,
    "",
    "## Overall status",
    `System: ${systemStatusLine(server)}`,
    "",
    "## System",
    `Server: ${systemStatusLine(server)}`,
    server && !server.error ? `API version: ${server.version ?? "?"}` : "",
    server && !server.error ? `Database: ${server.database ?? "?"}` : "",
    server && !server.error ? `MQTT: ${server.mqtt ?? "?"}` : "",
    `Authentication: ${client.accessTokenPresent ? auth?.meUsername ?? "signed in" : "not signed in"}`,
    server?.counts
      ? `Devices: ${server.counts.devicesEnabled ?? "?"} enabled, ${server.counts.devicesOnline ?? "?"} online`
      : "",
    `Client errors: ${client.recentErrors.length === 0 ? "none" : String(client.recentErrors.length)}`,
    "",
    "## Technical details — client",
    `uiVersion: ${client.uiVersion}`,
    `href: ${client.href}`,
    `viewport: ${client.viewport.width}×${client.viewport.height}`,
    `secureContext: ${client.isSecureContext}`,
    `randomUUID: ${client.randomUuid}`,
    `apiBase: ${client.apiBase}`,
    "",
  ].filter(Boolean);

  if (client.recentErrors.length > 0) {
    lines.push("### Recent client errors");
    for (const e of client.recentErrors) {
      lines.push(`- [${e.at}] ${e.kind}: ${e.message}`);
    }
    lines.push("");
  }

  if (server && !server.error && server.process) {
    lines.push(
      "### Server process",
      `uptimeSeconds: ${server.process.uptimeSeconds ?? "?"}`,
      `nodeVersion: ${server.process.nodeVersion ?? "?"}`,
      ""
    );
  }


  return lines.join("\n");
}
