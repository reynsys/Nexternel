// Nexternel Anywhere — the home link.
//
// Runs at home, next to Nexternel. Calls out to the door (Reynsys' server) and keeps that line open,
// so nothing changes on the home router. When the door says a phone (or the GPS tracker) is
// knocking, this opens a second connection to the door and joins it to the right place at home:
//   https → Caddy's outside entrance (the padlock ends here, at home)
//   http  → Caddy port 80 (only the certificate check is ever sent)
//   gps   → Traccar's tracker port
// For https the phone's real address is passed to Caddy first (PROXY protocol line), so the login
// guard and "inside or outside" see the real visitor, not the door.
//
// Settings: the file Nexternel writes (Settings → System → Nexternel Anywhere), read again every
// few seconds, so switching it on or off or changing the name needs no restart. Environment
// values are used when there is no file (tests). No dependencies, only Node.

import net from "node:net";
import http from "node:http";
import tls from "node:tls";
import fs from "node:fs";
import path from "node:path";

const env = process.env;
const SETTINGS_FILE = env.LINK_SETTINGS_FILE || "";
const DOOR_PORT = Number(env.LINK_DOOR_PORT || 7443);
const VERSION = env.LINK_VERSION || "dev";
const DOOR_CA = env.LINK_DOOR_CA ? fs.readFileSync(env.LINK_DOOR_CA) : undefined; // only for testing
const STATUS_FILE = env.LINK_STATUS_FILE || "";
const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

/** Current settings: { on, name, key, doorHost }. */
function readSettings() {
  let s = { enabled: true, name: env.LINK_NAME, key: env.LINK_KEY, doorDomain: env.LINK_DOOR_DOMAIN };
  if (SETTINGS_FILE) {
    try {
      s = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    } catch {
      s = { enabled: false };
    }
  }
  const name = String(s.name || "").toLowerCase();
  const key = typeof s.key === "string" ? s.key : "";
  const domain = String(s.doorDomain || "nexternel.net").toLowerCase();
  return {
    on: s.enabled === true && NAME_RE.test(name) && key.length >= 32,
    name,
    key,
    doorHost: env.LINK_DOOR_HOST || `door.${domain}`,
    address: `${name}.${domain}`,
  };
}
let cfg = readSettings();
const sameSettings = (a, b) => a.on === b.on && a.name === b.name && a.key === b.key && a.doorHost === b.doorHost;

function target(spec, fallback) {
  const [host, port] = (spec || fallback).split(":");
  return { host, port: Number(port) };
}
const TARGETS = {
  https: target(env.LINK_HTTPS_TARGET, "caddy:8443"),
  http: target(env.LINK_HTTP_TARGET, "caddy:80"),
  gps: target(env.LINK_GPS_TARGET, "traccar:5013"),
};

const log = (...a) => console.log(new Date().toISOString(), ...a);

let status = { state: "starting", since: Date.now(), address: null, gpsPort: null, error: null };
function setStatus(s) {
  status = {
    ...status,
    ...s,
    name: cfg.on ? cfg.name : null, // the name these states are for
    since: s.state && s.state !== status.state ? Date.now() : status.since,
    seen: Date.now(),
  };
  if (STATUS_FILE) {
    try {
      fs.writeFileSync(STATUS_FILE + ".tmp", JSON.stringify(status));
      fs.renameSync(STATUS_FILE + ".tmp", STATUS_FILE);
    } catch {}
  }
}

function connectDoor() {
  const host = env.LINK_DOOR_CONNECT || cfg.doorHost; // LINK_DOOR_CONNECT: only for testing, where to dial
  return tls.connect({ host, port: DOOR_PORT, servername: cfg.doorHost, ca: DOOR_CA, minVersion: "TLSv1.2" });
}

const send = (sock, msg) => !sock.destroyed && sock.write(JSON.stringify(msg) + "\n");

// Plain http from outside is only ever the padlock certificate check. It is never joined to home:
// exactly one request is read, it must be a certificate check for this home's own address, the
// link asks Caddy for that one file itself and hangs up. Nothing else can ride along on the line.
const CHECK_ANSWER = /^[A-Za-z0-9_-]{1,200}\.[A-Za-z0-9_-]{20,100}$/;
const CHECK_PATH = /^\/\.well-known\/acme-challenge\/[A-Za-z0-9_-]{1,200}$/;
function answerCertificateCheck(door) {
  let buf = Buffer.alloc(0);
  let done = false;
  const reply = (status, body = "") => {
    if (done) return;
    done = true;
    const b = Buffer.from(body);
    door.end(`HTTP/1.1 ${status}\r\nContent-Type: text/plain\r\nConnection: close\r\nContent-Length: ${b.length}\r\n\r\n${b}`);
  };
  door.setTimeout(10_000, () => door.destroy());
  door.on("data", (chunk) => {
    if (done) return;
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > 8192) return reply("400 Bad Request");
    const end = buf.indexOf("\r\n\r\n");
    if (end < 0) return;
    const [method, path, version] = buf.subarray(0, buf.indexOf("\r\n")).toString("latin1").split(" ");
    if (method !== "GET" || !CHECK_PATH.test(path || "") || !/^HTTP\/1\.[01]$/.test(version || "")) return reply("404 Not Found");
    const req = http.get(
      { host: TARGETS.http.host, port: TARGETS.http.port, path, headers: { Host: cfg.address }, timeout: 8_000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (d) => {
          body += d;
          if (body.length > 4096) req.destroy();
        });
        // Only a genuine check answer ("<token>.<account fingerprint>") is passed back, never a page.
        res.on("end", () => {
          const good = res.statusCode === 200 && CHECK_ANSWER.test(body.trim()) && body.trim().startsWith(path.split("/").pop() + ".");
          reply(good ? "200 OK" : "404 Not Found", good ? body.trim() : "");
        });
      },
    );
    req.on("error", () => reply("404 Not Found"));
    req.on("timeout", () => req.destroy());
  });
}

// The door asks: a visitor is waiting. Answer with a fresh connection and join it to home.
function answer(msg) {
  if (msg.kind === "http") {
    const door = connectDoor();
    door.on("error", () => door.destroy());
    door.once("secureConnect", () => {
      send(door, { answer: msg.open, home: cfg.name, key: cfg.key });
      answerCertificateCheck(door);
    });
    return;
  }
  const t = TARGETS[msg.kind];
  if (!t) return;
  const door = connectDoor();
  const home = net.connect(t.port, t.host);
  const end = () => {
    door.destroy();
    home.destroy();
  };
  door.on("error", end).on("close", end);
  home.on("error", end).on("close", end);
  door.once("secureConnect", () => {
    send(door, { answer: msg.open, home: cfg.name, key: cfg.key });
    if (msg.kind === "https") {
      const ip = String(msg.from || "").replace(/^::ffff:/, "");
      const fam = net.isIPv4(ip) ? "TCP4" : net.isIPv6(ip) ? "TCP6" : null;
      if (!fam) return end(); // no real address: not let in (the login guard needs it)
      home.write(`PROXY ${fam} ${ip} ${ip} ${Number(msg.fromPort) || 0} 443\r\n`);
    }
    door.pipe(home);
    home.pipe(door);
  });
}

let wait = 1000;
let line = null; // the open home line, if any
let retry = null;
function later(ms) {
  clearTimeout(retry);
  retry = setTimeout(start, ms);
}
function start() {
  retry = null;
  if (!cfg.on) {
    setStatus({ state: "off", address: null, gpsPort: null, error: null });
    return;
  }
  setStatus({ state: "connecting", error: null });
  const sock = connectDoor();
  line = sock;
  let buf = Buffer.alloc(0);
  let welcomed = false;
  sock.setTimeout(90_000, () => sock.destroy(new Error("door silent")));
  sock.on("secureConnect", () => send(sock, { hello: cfg.name, key: cfg.key, version: VERSION }));
  sock.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    let i;
    while ((i = buf.indexOf(0x0a)) >= 0) {
      let msg;
      try {
        msg = JSON.parse(buf.subarray(0, i).toString("utf8"));
      } catch {
        return sock.destroy();
      }
      buf = buf.subarray(i + 1);
      if (msg.welcome) {
        welcomed = true;
        wait = 1000;
        setStatus({ state: "open", address: msg.address, gpsPort: msg.gpsPort, error: null });
        log(`door open: https://${msg.address}${msg.gpsPort ? `, GPS port ${msg.gpsPort}` : ""}`);
      } else if (msg.refused) {
        setStatus({ state: "refused", error: msg.refused });
        log(`door refused: ${msg.refused}`);
        wait = 5 * 60_000; // wrong key: do not knock every second
      } else if (msg.ping) {
        send(sock, { pong: msg.ping });
      } else if (msg.open && welcomed) {
        answer(msg);
      }
    }
    if (buf.length > 64 * 1024) sock.destroy();
  });
  sock.on("error", (e) => setStatus({ error: e.message }));
  sock.on("close", () => {
    if (line !== sock) return; // replaced on purpose (settings changed)
    line = null;
    if (!cfg.on) return start();
    if (status.state !== "refused") setStatus({ state: "connecting" });
    log(`door line closed; trying again in ${Math.round(wait / 1000)} s`);
    later(wait);
    wait = Math.min(wait * 2, 60_000);
  });
}

// Settings changed (switched on/off, new name or key): drop the line and start again at once.
// Noticed at once through a watch on the folder (the file is replaced, not edited), and every
// few seconds in case a watch is missed.
function settingsMaybeChanged() {
  const next = readSettings();
  if (sameSettings(next, cfg)) return;
  cfg = next;
  log(cfg.on ? `settings changed: ${cfg.name} via ${cfg.doorHost}` : "switched off");
  wait = 1000;
  const old = line;
  line = null;
  if (old) old.destroy();
  if (status.state === "refused") setStatus({ state: "connecting" });
  later(0);
}
setInterval(settingsMaybeChanged, 5_000);
if (SETTINGS_FILE) {
  try {
    fs.watch(path.dirname(SETTINGS_FILE), () => setTimeout(settingsMaybeChanged, 50));
  } catch {}
}

// Sign of life for Nexternel's Settings card.
setInterval(() => setStatus({}), 30_000);

start();
