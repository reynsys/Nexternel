/**
 * One Zherodius direct line (version 2): its own TCP connection to port 7368 (Zherodius 1.13.1+), apart from the
 * device's web page, so the page never waits for the line. Each message: 1 byte kind (1 = words, 2 = bytes),
 * 2 bytes length (high byte first), the message. Older devices only have the WebSocket ws://<address>/api/line:
 * when port 7368 refuses the connection, the line goes there instead.
 * - pairDevice: once, with the code shown on the device's page (SPAKE2+); proves both long-term keys.
 * - openLine: every connection (Noise IK); then encrypted JSON asks/answers and the device's NotifyStatus.
 * The device's key is pinned at pairing: a hello with any other key is refused.
 */
import net from "node:net";
import {
  cleanCode,
  hex,
  noiseInitiator,
  spakeProver,
  spakeSecrets,
  unhex,
  WrongCodeError,
  type CipherState,
  type X25519Key,
} from "./line-crypto.js";

export type Hello = {
  zherodius: number;
  serial: string;
  name: string;
  version: string;
  key: string;
  pairing: boolean;
  salt?: string;
};

/** What the device can say it is made of (Zh.GetInfo). */
export type DeviceInfo = {
  name: string;
  serial: string;
  board: string;
  version: string;
  mac: string;
  parts: { id: number; type: string; name: string; model?: string; reads?: string[] }[];
};

/** What the device reports now (Zh.GetStatus and NotifyStatus). */
export type DeviceStatus = {
  relays?: { id: number; on: boolean }[];
  /** t °C, h %, p hPa, c CO2 ppm. */
  sensors?: { id: number; t?: number; h?: number; p?: number; c?: number; w?: number; e?: number }[];
  rssi?: number;
  uptime?: number;
  cfg?: number;
  /** The newer version the device's update check found, "" = none (Zherodius 1.12.1+). */
  update?: string;
};

/** What the device says about its updates (Zh.GetUpdate and Zh.Update; the same as its Firmware page). */
export type DeviceUpdate = {
  version: string;
  /** The newer version found, "" = none. */
  latest: string;
  notes: string;
  state: "idle" | "checking" | "installing" | "done" | "failed" | string;
  progress: number;
  /** Why the last check or install failed. */
  message: string;
  auto: boolean;
  /** When it last checked (seconds since 1970, 0 = not yet). */
  lastCheck: number;
  /** A new version is running on trial (it goes back by itself if it does not start properly). */
  trying: boolean;
};

/** The first Zherodius version that can be updated from Nexternel (Zh.GetUpdate, Zh.Update). */
export const UPDATES_FROM_HUB = "1.12.1";

/** Versions compared number by number (1.11.10 is newer than 1.11.9). Gives -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const x = a.split(".").map((n) => parseInt(n, 10) || 0);
  const y = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1;
  return 0;
}

/** Something the person can be told as it is ("The pairing code is not right."). */
export class LineError extends Error {}
/** The device did not answer an ask in time (the ask may still have been carried out). */
export class NoAnswerError extends LineError {}

/** The device's answer to a hub it does not know (Zherodius direct line description, docs/direct-line.md). */
export const NOT_PAIRED_WORDS = "This hub is not paired with this device.";

/** The device does not accept this Nexternel any more: only pairing again helps (not trying more often). */
export class NotPairedError extends LineError {
  constructor(
    message: string,
    readonly why: "forgotten" | "reset"
  ) {
    super(message);
  }
}

const CONNECT_MS = 5_000;
const ANSWER_MS = 5_000;
/** Opening the line takes the device about a second (four X25519 steps); allow for a busy one. */
const HANDSHAKE_MS = 8_000;
const EMPTY = Buffer.alloc(0);
const LINE_VERSION = 2;
/** The device's own port for the line (Zherodius 1.13.1+). */
export const LINE_PORT = 7368;
/** The longest message the device takes; what it sends is only limited by the 2-byte length. */
const MAX_MESSAGE = 4096;
const K_TEXT = 1;
const K_BYTES = 2;

/** One line connection, whichever way it goes: next() gives the next message (text or bytes), or null once closed. */
interface LineSocket {
  next(ms: number): Promise<string | Buffer | null>;
  listen(onMessage: (m: string | Buffer) => void, onClose: () => void): void;
  send(m: string | Buffer): void;
  close(): void;
}


/** Messages in arrival order, for whoever waits for them; the same for both ways of connecting. */
class Inbox {
  private queue: (string | Buffer)[] = [];
  private waiters: ((m: string | Buffer | null) => void)[] = [];
  private closed = false;
  private onMessage: ((m: string | Buffer) => void) | null = null;
  private onClose: (() => void) | null = null;

  put(m: string | Buffer) {
    if (this.closed) return;
    if (this.onMessage) this.onMessage(m);
    else if (this.waiters.length) this.waiters.shift()!(m);
    else this.queue.push(m);
  }

  end() {
    if (this.closed) return;
    this.closed = true;
    while (this.waiters.length) this.waiters.shift()!(null);
    this.onClose?.();
  }

  get isClosed() {
    return this.closed;
  }

  next(ms: number): Promise<string | Buffer | null> {
    if (this.queue.length) return Promise.resolve(this.queue.shift()!);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => {
      const waiter = (m: string | Buffer | null) => {
        clearTimeout(timer);
        resolve(m);
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        resolve(null);
      }, ms);
      this.waiters.push(waiter);
    });
  }

  listen(onMessage: (m: string | Buffer) => void, onClose: () => void) {
    this.onMessage = onMessage;
    this.onClose = onClose;
    for (const m of this.queue.splice(0)) onMessage(m);
    if (this.closed) onClose();
  }
}

/** The line on the device's own port (Zherodius 1.13.1+). */
class TcpSocket implements LineSocket {
  private readonly inbox = new Inbox();
  private pending: Buffer = Buffer.alloc(0);

  private constructor(private readonly sock: net.Socket) {
    sock.setNoDelay(true);
    sock.setKeepAlive(true, 20_000);
    sock.on("data", (d: Buffer) => this.take(d));
    sock.on("close", () => this.inbox.end());
    sock.on("error", () => sock.destroy());
  }

  /** Opens the line; "refused" when the device has no line port (an older Zherodius). */
  static open(host: string, port: number): Promise<TcpSocket | "refused"> {
    return new Promise((resolve, reject) => {
      const sock = net.connect({ host, port });
      const timer = setTimeout(() => {
        sock.destroy();
        reject(new LineError(`No answer from ${host}.`));
      }, CONNECT_MS);
      sock.once("connect", () => {
        clearTimeout(timer);
        sock.removeAllListeners("error");
        resolve(new TcpSocket(sock));
      });
      sock.once("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        sock.destroy();
        if (err.code === "ECONNREFUSED") resolve("refused");
        else reject(new LineError(`No answer from ${host}.`));
      });
    });
  }

  private take(d: Buffer) {
    this.pending = this.pending.length ? Buffer.concat([this.pending, d]) : d;
    while (this.pending.length >= 3) {
      const kind = this.pending[0];
      const n = this.pending.readUInt16BE(1);
      if (kind !== K_TEXT && kind !== K_BYTES) {
        this.sock.destroy(); // not this line's messages: nothing is guessed
        return;
      }
      if (this.pending.length < 3 + n) return;
      const body = Buffer.from(this.pending.subarray(3, 3 + n));
      this.pending = this.pending.subarray(3 + n);
      this.inbox.put(kind === K_TEXT ? body.toString("utf8") : body);
    }
  }

  next(ms: number) {
    return this.inbox.next(ms);
  }

  listen(onMessage: (m: string | Buffer) => void, onClose: () => void) {
    this.inbox.listen(onMessage, onClose);
  }

  send(m: string | Buffer) {
    const body = typeof m === "string" ? Buffer.from(m, "utf8") : m;
    if (body.length > MAX_MESSAGE) throw new LineError("A message for the device is too long.");
    const head = Buffer.alloc(3);
    head[0] = typeof m === "string" ? K_TEXT : K_BYTES;
    head.writeUInt16BE(body.length, 1);
    this.sock.write(Buffer.concat([head, body]));
  }

  close() {
    if (!this.inbox.isClosed) this.sock.destroy();
  }
}

/** The address's host part ("192.168.1.40" from "192.168.1.40:80"). */
function hostOf(address: string): string {
  const i = address.lastIndexOf(":");
  return i > 0 ? address.slice(0, i) : address;
}

/** The line to a device: its own port first; a device that refuses it is an older one, reached over the WebSocket. */
async function connect(address: string, linePort = LINE_PORT): Promise<LineSocket> {
  const tcp = await TcpSocket.open(hostOf(address), linePort);
  return tcp === "refused" ? WsSocket.open(address) : tcp;
}

/** The line over the device's web page (Zherodius before 1.13.1). */
class WsSocket implements LineSocket {
  private readonly inbox = new Inbox();

  private constructor(private readonly ws: WebSocket) {
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => this.inbox.put(typeof e.data === "string" ? e.data : Buffer.from(e.data as ArrayBuffer));
    ws.onclose = () => this.inbox.end();
  }

  static open(address: string): Promise<WsSocket> {
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(`ws://${address}/api/line`);
      } catch {
        reject(new LineError(`${address} is not a device address.`));
        return;
      }
      const timer = setTimeout(() => {
        ws.close();
        reject(new LineError(`No answer from ${address}.`));
      }, CONNECT_MS);
      ws.onopen = () => {
        clearTimeout(timer);
        resolve(new WsSocket(ws));
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new LineError(`No answer from ${address}.`));
      };
    });
  }

  next(ms: number) {
    return this.inbox.next(ms);
  }

  listen(onMessage: (m: string | Buffer) => void, onClose: () => void) {
    this.inbox.listen(onMessage, onClose);
  }

  send(m: string | Buffer) {
    this.ws.send(m);
  }

  close() {
    if (!this.inbox.isClosed) this.ws.close();
  }
}

function parseText<T>(m: string | Buffer | null, what: string): T {
  if (typeof m !== "string") throw new LineError(`The device did not send its ${what}.`);
  try {
    return JSON.parse(m) as T;
  } catch {
    throw new LineError(`The device's ${what} could not be read.`);
  }
}

async function readHello(sock: LineSocket): Promise<Hello> {
  const hello = parseText<{ hello?: Hello }>(await sock.next(ANSWER_MS), "greeting").hello;
  if (!hello || typeof hello.key !== "string" || !/^[0-9a-f]{64}$/i.test(hello.key) || typeof hello.serial !== "string") {
    throw new LineError("This is not a Zherodius device, or it sent a greeting Nexternel does not understand.");
  }
  if (hello.zherodius !== LINE_VERSION) {
    throw new LineError(`This device speaks direct line ${hello.zherodius}; Nexternel speaks ${LINE_VERSION}. Update the device first.`);
  }
  return hello;
}

/**
 * Pair with a device: the owner has opened pairing on the device's page and typed its code here.
 * Returns the device's greeting; its key (hello.key) is the one to keep and check from now on.
 */
export async function pairDevice(o: { address: string; code: string; hub: X25519Key; hubName: string; linePort?: number }): Promise<Hello> {
  if (cleanCode(o.code).length !== 8) throw new LineError("The pairing code has 8 letters and numbers, as shown on the device's page.");
  const sock = await connect(o.address, o.linePort);
  try {
    const hello = await readHello(sock);
    if (!hello.pairing || !hello.salt) {
      throw new LineError(`Pairing is not open on ${hello.name}. Open it on the device's page (Settings → Nexternel), then type the code shown there.`);
    }
    const deviceKey = unhex(hello.key);
    const s = spakeSecrets(o.code, unhex(hello.salt), o.hub.pub, deviceKey);
    const prover = spakeProver({ idProver: o.hub.pub, idVerifier: deviceKey, w0: s.w0, w1: s.w1 });
    sock.send(JSON.stringify({ pair: { hub: o.hubName, key: hex(o.hub.pub), share: hex(prover.shareP) } }));
    const a = parseText<{ pair?: { share?: string; confirm?: string; error?: string } }>(await sock.next(ANSWER_MS), "pairing answer").pair;
    if (!a || a.error) throw new LineError(a?.error ?? "The device did not answer the pairing.");
    let done;
    try {
      done = prover.finish(unhex(a.share ?? ""), unhex(a.confirm ?? ""));
    } catch (err) {
      if (err instanceof WrongCodeError) throw new LineError(err.message);
      throw new LineError("The device's pairing answer could not be checked.");
    }
    sock.send(JSON.stringify({ pair: { confirm: hex(done.confirmP) } }));
    const b = parseText<{ pair?: { ok?: boolean; error?: string } }>(await sock.next(ANSWER_MS), "pairing result").pair;
    if (!b?.ok) throw new LineError(b?.error ?? "The device did not confirm the pairing.");
    return hello;
  } finally {
    sock.close();
  }
}

export type Line = {
  hello: Hello;
  /** Ask the device; gives its result, or throws LineError with the device's own words. */
  call<T>(method: string, params?: Record<string, unknown>, ms?: number): Promise<T>;
  close(): void;
};

/**
 * Open the line to a paired device. `deviceKey` is the key kept at pairing; a device answering with
 * another key is refused. onStatus gets every NotifyStatus; onClose fires once when the line ends.
 */
export async function openLine(o: {
  address: string;
  hub: X25519Key;
  deviceKey: string;
  serial: string;
  onStatus: (status: DeviceStatus) => void;
  onClose: () => void;
  /** The device's line port (LINE_PORT unless a test says otherwise). */
  linePort?: number;
}): Promise<Line> {
  const sock = await connect(o.address, o.linePort);
  let opened = false;
  try {
    const hello = await readHello(sock);
    if (hello.serial !== o.serial) throw new LineError(`Another device (${hello.name}, ${hello.serial}) now answers at ${o.address}.`);
    if (hello.key.toLowerCase() !== o.deviceKey.toLowerCase()) {
      throw new NotPairedError(
        `${hello.name} answers with another key than when it was paired (it was reset), so Nexternel does not trust it. Pair it again.`,
        "reset"
      );
    }
    const ini = noiseInitiator({ s: o.hub, rs: unhex(o.deviceKey) });
    sock.send(ini.writeMessage1());
    const m2 = await sock.next(HANDSHAKE_MS);
    if (m2 === null) throw new LineError(`${hello.name} did not open the line.`);
    if (typeof m2 === "string") {
      const words = parseText<{ line?: { error?: string } }>(m2, "answer").line?.error;
      if (words === NOT_PAIRED_WORDS) {
        throw new NotPairedError(
          `${hello.name} no longer lists this Nexternel (it was removed on the device's page, or the device was reset). Pair it again.`,
          "forgotten"
        );
      }
      throw new LineError(words ?? `${hello.name} did not open the line.`);
    }
    let send: CipherState;
    let recv: CipherState;
    try {
      ({ send, recv } = ini.readMessage2(m2));
    } catch {
      throw new LineError(`${hello.name}'s answer to the line opening could not be checked.`);
    }

    let nextId = 0;
    const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(new LineError(`The line to ${hello.name} closed.`));
      }
      pending.clear();
      sock.close();
      o.onClose();
    };
    const onMessage = (m: string | Buffer) => {
      // Anything that is not a message of this line (or does not open) ends it: nothing is guessed.
      if (typeof m === "string") return end();
      let msg: { id?: number; result?: unknown; error?: { message?: string }; method?: string; params?: unknown };
      try {
        msg = JSON.parse(recv.decrypt(EMPTY, m).toString("utf8"));
      } catch {
        return end();
      }
      if (msg.method === "NotifyStatus") {
        o.onStatus((msg.params ?? {}) as DeviceStatus);
        return;
      }
      const p = typeof msg.id === "number" ? pending.get(msg.id) : undefined;
      if (!p) return;
      pending.delete(msg.id!);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new LineError(msg.error.message ?? `${hello.name} refused that.`));
      else p.resolve(msg.result);
    };
    sock.listen(onMessage, end);

    opened = true;
    return {
      hello,
      call<T>(method: string, params?: Record<string, unknown>, ms = ANSWER_MS): Promise<T> {
        if (ended) return Promise.reject(new LineError(`The line to ${hello.name} is closed.`));
        const id = ++nextId;
        return new Promise<T>((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new NoAnswerError(`No answer from ${hello.name}.`));
          }, ms);
          pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
          sock.send(send.encrypt(EMPTY, Buffer.from(JSON.stringify(params ? { id, method, params } : { id, method }))));
        });
      },
      close: end,
    };
  } finally {
    if (!opened) sock.close();
  }
}
