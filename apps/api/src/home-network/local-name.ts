import http from "node:http";

/** The socket file the local-name service answers on (shared volume, never on the network). */
export const HOME_NETWORK_SOCKET = process.env.HOME_NETWORK_SOCKET || "/run/home-network/search.sock";

export class LocalNameUnavailable extends Error {}

/** Ask the local-name service (it runs on the home network itself) and read its JSON answer. */
export function askLocalName<T>(path: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.get({ socketPath: HOME_NETWORK_SOCKET, path, timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 5_000_000) req.destroy(new Error("answer too large"));
      });
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error(`local-name answered ${res.statusCode}`));
        try {
          resolve(JSON.parse(body) as T);
        } catch {
          reject(new Error("local-name answer could not be read"));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("local-name took too long")));
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT" || err.code === "ECONNREFUSED") {
        reject(new LocalNameUnavailable("The local-name service is not running."));
      } else {
        reject(err);
      }
    });
  });
}
