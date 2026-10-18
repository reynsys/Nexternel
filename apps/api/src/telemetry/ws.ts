import type { FastifyPluginAsync } from "fastify";
import websocket from "@fastify/websocket";
import { verifyTokenDetailed } from "../auth/tokens.js";
import { ACCESS_COOKIE } from "../config.js";
import { getAllLiveStates, subscribeLive } from "../telemetry/state-cache.js";
import { statusEngine } from "../capabilities/status-lights.js";
import { subscribeChanges } from "../live/changes.js";
import { APP_VERSION } from "../version.js";

function tokenFromRequest(request: {
  headers: { authorization?: string; cookie?: string };
  query: unknown;
}): string | null {
  const q = request.query as { access_token?: string };
  if (q.access_token) return q.access_token;
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  const cookieHeader = request.headers.cookie ?? "";
  const match = cookieHeader.match(new RegExp(`${ACCESS_COOKIE}=([^;]+)`));
  if (match) return decodeURIComponent(match[1]);
  return null;
}

export const wsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(websocket);

  app.get("/api/v1/ws", { websocket: true }, (socket, request) => {
    void (async () => {
      const token = tokenFromRequest(request);
      if (!token) {
        socket.send(JSON.stringify({ type: "error", message: "Authentication required" }));
        socket.close();
        return;
      }
      const verified = await verifyTokenDetailed(token);
      if (!verified.ok || verified.payload.tokenType !== "access") {
        socket.send(JSON.stringify({ type: "error", message: "Invalid token" }));
        socket.close();
        return;
      }

      const send = (event: unknown) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(event));
        }
      };

      // ?channel=changes: only the "something changed" messages (every screen keeps one open).
      const changesOnly = (request.query as { channel?: string }).channel === "changes";
      const stops: Array<() => void> = [];
      if (changesOnly) {
        socket.send(JSON.stringify({ type: "hello", channel: "changes", version: APP_VERSION }));
        stops.push(subscribeChanges(send));
      } else {
        socket.send(
          JSON.stringify({
            type: "hello",
            states: getAllLiveStates(),
            statuses: statusEngine.all(),
          })
        );
        stops.push(subscribeLive(send), statusEngine.subscribe(send));
      }

      socket.on("close", () => {
        for (const stop of stops) stop();
      });

      socket.on("message", (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as { type?: string };
          if (msg.type === "ping") {
            socket.send(JSON.stringify({ type: "pong" }));
          }
        } catch {
          /* ignore */
        }
      });
    })();
  });
};
