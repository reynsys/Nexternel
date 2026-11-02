/**
 * Request logging without secrets: the live-updates connection carries the sign-in pass in its
 * address (?access_token=…), and the request log printed it in full.
 */
const SECRET_PARAM = /token|password|secret|key/i;

/** The address with the values of secret-looking query parameters replaced by "[hidden]". */
export function redactUrlSecrets(url: string): string {
  const q = url.indexOf("?");
  if (q < 0) return url;
  const query = url
    .slice(q + 1)
    .split("&")
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq < 0) return part;
      const name = decodeURIComponentSafe(part.slice(0, eq));
      return SECRET_PARAM.test(name) ? `${part.slice(0, eq)}=[hidden]` : part;
    })
    .join("&");
  return `${url.slice(0, q)}?${query}`;
}

function decodeURIComponentSafe(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

type LoggedRequest = {
  method: string;
  url: string;
  host?: string;
  ip?: string;
  socket?: { remotePort?: number };
};

/** Fastify's usual request log fields, with the address redacted. */
export function serializeRequestForLog(req: LoggedRequest) {
  return {
    method: req.method,
    url: redactUrlSecrets(req.url),
    host: req.host,
    remoteAddress: req.ip,
    remotePort: req.socket?.remotePort,
  };
}
