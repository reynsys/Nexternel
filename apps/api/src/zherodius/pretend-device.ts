/**
 * A pretend Zherodius device for the automatic tests: it speaks direct line 2 exactly as
 * ZherodiuS docs/direct-line.md describes (its side of SPAKE2+ and Noise IK, the same asks and
 * NotifyStatus), so the hub side is tested end to end without touching a real board.
 * Never used by the running server.
 */
import { WebSocketServer, type WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import crypto from "node:crypto";
import { hex, noiseResponder, spakeL, spakeSecrets, spakeVerifier, unhex, x25519Key, type CipherState } from "./line-crypto.js";
import type { DeviceInfo, DeviceStatus } from "./line.js";

type Conn = { ws: WebSocket; send?: CipherState; recv?: CipherState };

export class PretendDevice {
  readonly key = x25519Key();
  serial = "ZH-TEST-0001";
  name = "Pretend Relays";
  version = "1.10.2";
  pairingCode: string | null = null;
  readonly pairedHubs = new Map<string, string>(); // hub key hex → hub name
  info: DeviceInfo;
  relays = new Map<number, boolean>([[1, false], [2, false]]);
  sensors = new Map<number, { t?: number; h?: number; p?: number }>([[3, { t: 21.5, h: 48 }]]);
  /** Asks received, in order (method names). */
  readonly asked: string[] = [];
  /** When false, Relay.Set is not answered (a device cut off mid-press). */
  answers = true;
  private readonly conns = new Set<Conn>();
  private server!: WebSocketServer;
  port = 0;

  constructor() {
    this.info = {
      name: this.name,
      serial: this.serial,
      board: "esp32-relay-x2",
      version: this.version,
      mac: "AA:BB:CC:DD:EE:FF",
      parts: [
        { id: 1, type: "relay", name: "Pump" },
        { id: 2, type: "relay", name: "Lights" },
        { id: 3, type: "sensor", name: "Shed", model: "SHT4x" },
      ],
    };
  }

  get address(): string {
    return `127.0.0.1:${this.port}`;
  }

  async start(port = 0, host = "127.0.0.1"): Promise<void> {
    this.server = new WebSocketServer({ port, host, path: "/api/line" });
    await new Promise<void>((r) => this.server.once("listening", () => r()));
    this.port = (this.server.address() as AddressInfo).port;
    this.server.on("connection", (ws) => this.connected(ws));
  }

  async stop(): Promise<void> {
    this.dropAll();
    await new Promise<void>((r) => this.server.close(() => r()));
  }

  /** Every open line ends (the device restarted or left the Wi-Fi). */
  dropAll() {
    for (const c of this.conns) c.ws.terminate();
    this.conns.clear();
  }

  get openLines(): number {
    return [...this.conns].filter((c) => c.send).length;
  }

  cfg(): number {
    return parseInt(crypto.createHash("sha256").update(JSON.stringify(this.info)).digest("hex").slice(0, 8), 16);
  }

  status(): DeviceStatus {
    return {
      relays: [...this.relays].map(([id, on]) => ({ id, on })),
      sensors: [...this.sensors].map(([id, r]) => ({ id, ...r })),
      rssi: -61,
      uptime: 1234,
      cfg: this.cfg(),
    };
  }

  /** Something changed on the device itself (its button, a new reading): every hub is told at once. */
  notify() {
    for (const c of this.conns) if (c.send) this.secret(c, { method: "NotifyStatus", params: this.status() });
  }

  private connected(ws: WebSocket) {
    const conn: Conn = { ws };
    this.conns.add(conn);
    ws.on("close", () => this.conns.delete(conn));
    const salt = crypto.randomBytes(16);
    ws.send(JSON.stringify({
      hello: { zherodius: 2, serial: this.serial, name: this.name, version: this.version, key: hex(this.key.pub), pairing: this.pairingCode !== null, ...(this.pairingCode ? { salt: hex(salt) } : {}) },
    }));
    let verifier: ReturnType<typeof spakeVerifier> | null = null;
    let pairingHub: { key: string; name: string } | null = null;
    ws.on("message", (data, isBinary) => {
      const buf = Buffer.from(data as Buffer);
      if (!isBinary) {
        const pair = JSON.parse(buf.toString()).pair;
        if (pair?.share && this.pairingCode) {
          const hubKey = unhex(pair.key);
          const s = spakeSecrets(this.pairingCode, salt, hubKey, this.key.pub);
          verifier = spakeVerifier({ idProver: hubKey, idVerifier: this.key.pub, w0: s.w0, L: spakeL(s.w1) }, unhex(pair.share));
          pairingHub = { key: pair.key, name: pair.hub };
          ws.send(JSON.stringify({ pair: { share: hex(verifier.shareV), confirm: hex(verifier.confirmV) } }));
        } else if (pair?.confirm && verifier && pairingHub) {
          if (verifier.check(unhex(pair.confirm))) {
            this.pairedHubs.set(pairingHub.key, pairingHub.name);
            ws.send(JSON.stringify({ pair: { ok: true } }));
          } else {
            ws.send(JSON.stringify({ pair: { error: "The pairing code is not right." } }));
          }
          ws.close();
        } else {
          ws.close();
        }
        return;
      }
      if (!conn.send) {
        const res = noiseResponder({ s: this.key });
        const m1 = res.readMessage1(buf);
        if (!this.pairedHubs.has(hex(m1.hubKey))) {
          ws.send(JSON.stringify({ line: { error: "This hub is not paired with this device." } }));
          ws.close();
          return;
        }
        const m2 = res.writeMessage2();
        ws.send(m2.message);
        conn.send = m2.send;
        conn.recv = m2.recv;
        return;
      }
      let ask: { id: number; method: string; params?: { id?: number; on?: boolean } };
      try {
        ask = JSON.parse(conn.recv!.decrypt(Buffer.alloc(0), buf).toString());
      } catch {
        ws.close();
        return;
      }
      this.asked.push(ask.method);
      this.answer(conn, ask);
    });
  }

  private answer(conn: Conn, ask: { id: number; method: string; params?: { id?: number; on?: boolean } }) {
    const reply = (body: object) => this.secret(conn, { id: ask.id, ...body });
    if (ask.method === "Zh.GetInfo") return reply({ result: this.info });
    if (ask.method === "Zh.GetStatus") return reply({ result: this.status() });
    if (ask.method === "Relay.Set" || ask.method === "Relay.Toggle") {
      const id = Number(ask.params?.id);
      if (!this.relays.has(id)) return reply({ error: { code: 400, message: "There is no relay with that number." } });
      if (!this.answers) return;
      const on = ask.method === "Relay.Set" ? Boolean(ask.params?.on) : !this.relays.get(id);
      this.relays.set(id, on);
      reply({ result: { on } });
      this.notify();
      return;
    }
    reply({ error: { code: 400, message: "Unknown ask." } });
  }

  private secret(conn: Conn, body: object) {
    conn.ws.send(conn.send!.encrypt(Buffer.alloc(0), Buffer.from(JSON.stringify(body))));
  }
}
