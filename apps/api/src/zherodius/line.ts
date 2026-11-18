/**
 * One Zherodius direct line (version 2): a WebSocket to ws://<address>/api/line.
 * - pairDevice: once, with the code shown on the device's page (SPAKE2+); proves both long-term keys.
 * - openLine: every connection (Noise IK); then encrypted JSON asks/answers and the device's NotifyStatus.
 * The device's key is pinned at pairing: a hello with any other key is refused.
 */
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
  sensors?: { id: number; t?: number; h?: number; p?: number }[];
  rssi?: number;
  uptime?: number;
  cfg?: number;
};

/** Something the person can be told as it is ("The pairing code is not right."). */
export class LineError extends Error {}
/** The device did not answer an ask in time (the ask may still have been carried out). */
export class NoAnswerError extends LineError {}

const CONNECT_MS = 5_000;
const ANSWER_MS = 5_000;
/** Opening the line takes the device about a second (four X25519 steps); allow for a busy one. */
const HANDSHAKE_MS = 8_000;
const EMPTY = Buffer.alloc(0);
const LINE_VERSION = 2;

/** A WebSocket with a queue: next() gives the next message (text or bytes), or null once closed. */
class Socket {
  private queue: (string | Buffer)[] = [];
  private waiters: ((m: string | Buffer | null) => void)[] = [];
  private closed = false;
  private onMessage: ((m: string | Buffer) => void) | null = null;
  private onClose: (() => void) | null = null;

  private constructor(private readonly ws: WebSocket) {
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => {
      const m = typeof e.data === "string" ? e.data : Buffer.from(e.data as ArrayBuffer);
      if (this.onMessage) this.onMessage(m);
      else if (this.waiters.length) this.waiters.shift()!(m);
      else this.queue.push(m);
    };
    ws.onclose = () => {
      this.closed = true;
      while (this.waiters.length) this.waiters.shift()!(null);
      this.onClose?.();
    };
  }

  static open(address: string): Promise<Socket> {
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
        resolve(new Socket(ws));
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new LineError(`No answer from ${address}.`));
      };
    });
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

  /** From now on every message goes to onMessage (those already waiting first), and the close to onClose. */
  listen(onMessage: (m: string | Buffer) => void, onClose: () => void) {
    this.onMessage = onMessage;
    this.onClose = onClose;
    for (const m of this.queue.splice(0)) onMessage(m);
    if (this.closed) onClose();
  }

  send(m: string | Buffer) {
    this.ws.send(m);
  }

  close() {
    if (!this.closed) this.ws.close();
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

async function readHello(sock: Socket): Promise<Hello> {
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
export async function pairDevice(o: { address: string; code: string; hub: X25519Key; hubName: string }): Promise<Hello> {
  if (cleanCode(o.code).length !== 8) throw new LineError("The pairing code has 8 letters and numbers, as shown on the device's page.");
  const sock = await Socket.open(o.address);
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
}): Promise<Line> {
  const sock = await Socket.open(o.address);
  let opened = false;
  try {
    const hello = await readHello(sock);
    if (hello.serial !== o.serial) throw new LineError(`Another device (${hello.name}, ${hello.serial}) now answers at ${o.address}.`);
    if (hello.key.toLowerCase() !== o.deviceKey.toLowerCase()) {
      throw new LineError(`${hello.name} answered with a key that is not the one kept when it was paired, so Nexternel does not trust it. Pair it again if the device was reset.`);
    }
    const ini = noiseInitiator({ s: o.hub, rs: unhex(o.deviceKey) });
    sock.send(ini.writeMessage1());
    const m2 = await sock.next(HANDSHAKE_MS);
    if (m2 === null) throw new LineError(`${hello.name} did not open the line.`);
    if (typeof m2 === "string") {
      const words = parseText<{ line?: { error?: string } }>(m2, "answer").line?.error;
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
