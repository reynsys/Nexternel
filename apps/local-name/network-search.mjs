// Home network search: notes what devices on the home network say about themselves (multicast
// DNS, the way phones find printers and TVs, and the camera standard ONVIF) and hands that list
// to the Nexternel server on request. It only listens and asks "who is there"; it never changes
// a device. The Nexternel server decides what each device is (apps/api/src/home-network/).
import dgram from "node:dgram";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { TYPE_A, TYPE_PTR, TYPE_SRV, TYPE_TXT, queryPacket, recordsIn } from "./dns.mjs";

/** The kinds of service Nexternel asks about. The server names what each one means. */
export const SERVICE_TYPES = [
  "_esphomelib._tcp.local",
  "_shelly._tcp.local",
  "_http._tcp.local",
  "_matterc._udp.local",
  "_matter._tcp.local",
  "_hap._tcp.local",
  "_googlecast._tcp.local",
  "_amzn-wplay._tcp.local",
  "_airplay._tcp.local",
  "_hue._tcp.local",
  "_ewelink._tcp.local",
  "_rtsp._tcp.local",
];

const KEEP_MS = 30 * 60 * 1000; // forget what was last heard over half an hour ago
const MAX_ENTRIES = 2000;

/** instance (lower case) → { type, instance, host, port, txt, from, seen } */
const services = new Map();
/** host name → { ip, seen } */
const hosts = new Map();
/** camera address → { address, xaddrs, scopes, seen } */
const cameras = new Map();

function typeOf(instanceLower) {
  return SERVICE_TYPES.find((t) => instanceLower.endsWith(`.${t}`)) ?? null;
}

function entryFor(instanceLower, type) {
  let e = services.get(instanceLower);
  if (!e) {
    if (services.size >= MAX_ENTRIES) prune(true);
    e = { type, instance: instanceLower.slice(0, -(type.length + 1)), host: null, port: null, txt: {}, from: null, seen: 0 };
    services.set(instanceLower, e);
  }
  return e;
}

/** Note everything a multicast DNS answer packet says. `from` is the sender's address. */
export function noteAnswer(msg, from) {
  const now = Date.now();
  for (const r of recordsIn(msg)) {
    if (r.type === TYPE_A) {
      if (r.ttl > 0) hosts.set(r.name, { ip: r.data, seen: now });
      continue;
    }
    if (r.type === TYPE_PTR) {
      // "_shelly._tcp.local → shellyplus1-abc._shelly._tcp.local" (also sub-types such as _L840._sub._matterc._udp.local)
      const instanceLower = r.data.toLowerCase();
      const type = typeOf(instanceLower);
      if (!type) continue;
      const e = entryFor(instanceLower, type);
      e.instance = r.data.slice(0, -(type.length + 1)); // keep the device's own letters
      if (r.ttl === 0) {
        services.delete(instanceLower); // the device said goodbye
        continue;
      }
      e.from = from;
      e.seen = now;
      continue;
    }
    const type = typeOf(r.name);
    if (!type) continue;
    const e = entryFor(r.name, type);
    if (r.type === TYPE_SRV) {
      e.host = r.data.target;
      e.port = r.data.port;
    } else if (r.type === TYPE_TXT) {
      e.txt = r.data;
    }
    e.from = from;
    e.seen = now;
  }
}

function prune(hard = false) {
  const limit = Date.now() - (hard ? KEEP_MS / 2 : KEEP_MS);
  for (const [k, v] of services) if (v.seen < limit) services.delete(k);
  for (const [k, v] of hosts) if (v.seen < limit) hosts.delete(k);
  for (const [k, v] of cameras) if (v.seen < limit) cameras.delete(k);
}

// --- ONVIF cameras (WS-Discovery: a "who is a camera?" message to everyone on the network) ---

function onvifProbe() {
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" ` +
      `xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">` +
      `<e:Header><w:MessageID>uuid:${randomUUID()}</w:MessageID>` +
      `<w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>` +
      `<w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header>` +
      `<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>`,
    "utf8"
  );
}

function textOf(xml, tag) {
  const m = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([^<]*)</(?:[\\w-]+:)?${tag}>`, "i").exec(xml);
  return m ? m[1].trim() : "";
}

function askCameras(waitMs) {
  return new Promise((resolve) => {
    const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const done = () => {
      try {
        s.close();
      } catch {
        /* already closed */
      }
      resolve();
    };
    s.on("error", done);
    s.on("message", (buf, rinfo) => {
      const xml = buf.toString("utf8", 0, Math.min(buf.length, 16384));
      if (!/ProbeMatch/i.test(xml)) return;
      cameras.set(rinfo.address, {
        address: rinfo.address,
        xaddrs: textOf(xml, "XAddrs").split(/\s+/).filter(Boolean).slice(0, 4),
        scopes: textOf(xml, "Scopes").split(/\s+/).filter(Boolean).slice(0, 30),
        seen: Date.now(),
      });
    });
    s.bind(0, () => {
      const probe = onvifProbe();
      s.send(probe, 3702, "239.255.255.250");
      setTimeout(() => s.send(probe, 3702, "239.255.255.250"), 800);
      setTimeout(done, waitMs);
    });
  });
}

// --- Asking and answering ---

let running = null;

/** Ask the network who is there, wait, and return everything heard recently. */
async function search(socket, port, group, waitMs) {
  if (!running) {
    running = (async () => {
      const ask = () => socket.send(queryPacket(SERVICE_TYPES, TYPE_PTR), port, group);
      ask();
      const timers = [setTimeout(ask, 1000), setTimeout(ask, 2500)];
      await askCameras(waitMs);
      timers.forEach(clearTimeout);
      // Devices that told us their host name but not its address yet: ask once more.
      const missing = [...services.values()].map((e) => e.host).filter((h) => h && !hosts.has(h));
      if (missing.length) {
        socket.send(queryPacket([...new Set(missing)].slice(0, 30), TYPE_A), port, group);
        await new Promise((r) => setTimeout(r, 700));
      }
    })().finally(() => {
      running = null;
    });
  }
  await running;
  prune();
  return {
    services: [...services.values()].map((e) => ({
      type: e.type.replace(/\.local$/, ""),
      instance: e.instance,
      host: e.host,
      port: e.port,
      address: (e.host && hosts.get(e.host)?.ip) || e.from,
      txt: e.txt,
      seenSecondsAgo: Math.round((Date.now() - e.seen) / 1000),
    })),
    cameras: [...cameras.values()].map((c) => ({
      address: c.address,
      xaddrs: c.xaddrs,
      scopes: c.scopes,
      seenSecondsAgo: Math.round((Date.now() - c.seen) / 1000),
    })),
  };
}

/** Answer the Nexternel server through a socket file shared with it (not open on the network). */
export function startSearchService({ socket, port, group, homeAddress }) {
  const socketPath = process.env.NEXTERNEL_HOME_NETWORK_SOCKET || "/run/home-network/search.sock";
  try {
    fs.mkdirSync(path.dirname(socketPath), { recursive: true });
    fs.rmSync(socketPath, { force: true });
  } catch (err) {
    console.error("home network search: cannot prepare", socketPath, err.message);
    return;
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://local");
    if (req.method === "GET" && url.pathname === "/address") {
      // The server's own address on the home network (the one devices must use to reach it).
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ address: homeAddress?.() ?? null }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
      return;
    }
    if (req.method === "GET" && url.pathname === "/search") {
      const wait = Math.min(8000, Math.max(1000, Number(url.searchParams.get("waitMs")) || 4000));
      try {
        const result = await search(socket, port, group, wait);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: String(err?.message ?? err) }));
      }
      return;
    }
    res.writeHead(404).end();
  });
  server.on("error", (err) => console.error("home network search:", err.message));
  server.listen(socketPath, () => {
    try {
      fs.chmodSync(socketPath, 0o660);
    } catch {
      /* the server still answers */
    }
    console.log(`Home network search ready (${socketPath})`);
  });
}
