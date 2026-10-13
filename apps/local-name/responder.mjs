// Answers "nexternel.local" on the home network (multicast DNS, the way printers and Apple
// devices are found by name), so phones and computers at home can open http://nexternel.local.
// No libraries: one small UDP listener. Runs with the host's network to see the home network.
import dgram from "node:dgram";
import { readFileSync } from "node:fs";
import os from "node:os";

const BASE_NAME = (process.env.NEXTERNEL_LOCAL_NAME || "nexternel").toLowerCase();
// Becomes "nexternel-2.local" if another machine on the network already answers to the name.
let NAME = `${BASE_NAME}.local`;
const GROUP = "224.0.0.251";
const PORT = 5353;
const TTL = 120;

/** The address of the interface the default route uses: the server's address on the home network. */
function homeAddress() {
  if (process.env.NEXTERNEL_LOCAL_ADDRESS) return process.env.NEXTERNEL_LOCAL_ADDRESS;
  try {
    const routes = readFileSync("/proc/net/route", "utf8").trim().split("\n").slice(1);
    const def = routes.map((l) => l.trim().split(/\s+/)).find((f) => f[1] === "00000000");
    const iface = def && os.networkInterfaces()[def[0]]?.find((a) => a.family === "IPv4" && !a.internal);
    if (iface) return iface.address;
  } catch {
    /* fall through */
  }
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (/^(docker|br-|veth|lo)/.test(name)) continue;
    const a = addrs?.find((x) => x.family === "IPv4" && !x.internal);
    if (a) return a.address;
  }
  return null;
}

function encodeName(name) {
  const parts = name.split(".").map((l) => {
    const b = Buffer.from(l, "utf8");
    return Buffer.concat([Buffer.from([b.length]), b]);
  });
  return Buffer.concat([...parts, Buffer.from([0])]);
}

/** Read a (possibly compressed) name at offset; returns [name, next offset]. */
function readName(buf, offset) {
  const labels = [];
  let pos = offset;
  let next = -1;
  for (let guard = 0; guard < 64; guard++) {
    const len = buf[pos];
    if (len === undefined) throw new Error("short packet");
    if (len === 0) {
      pos += 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      if (next < 0) next = pos + 2;
      pos = ((len & 0x3f) << 8) | buf[pos + 1];
      continue;
    }
    labels.push(buf.toString("utf8", pos + 1, pos + 1 + len));
    pos += 1 + len;
  }
  return [labels.join(".").toLowerCase(), next >= 0 ? next : pos];
}

/** An answer: NAME has address IP. */
function answer(ip, { id = 0, question = null, flush = true } = {}) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(0x8400, 2); // response, authoritative
  header.writeUInt16BE(question ? 1 : 0, 4);
  header.writeUInt16BE(1, 6);
  const name = encodeName(NAME);
  const rr = Buffer.alloc(10);
  rr.writeUInt16BE(1, 0); // A record
  rr.writeUInt16BE(flush ? 0x8001 : 0x0001, 2); // class IN (+ cache flush on multicast)
  rr.writeUInt32BE(TTL, 4);
  rr.writeUInt16BE(4, 8);
  const addr = Buffer.from(ip.split(".").map(Number));
  return Buffer.concat([header, ...(question ? [question] : []), name, rr, addr]);
}

/** Addresses other machines give for `name` in an answer packet. */
function addressesIn(msg, name) {
  const found = [];
  let pos = 12;
  const qd = msg.readUInt16BE(4);
  const an = msg.readUInt16BE(6);
  for (let i = 0; i < qd; i++) pos = readName(msg, pos)[1] + 4;
  for (let i = 0; i < an; i++) {
    const [rname, after] = readName(msg, pos);
    const type = msg.readUInt16BE(after);
    const len = msg.readUInt16BE(after + 8);
    if (rname === name && type === 1 && len === 4) found.push([...msg.subarray(after + 10, after + 14)].join("."));
    pos = after + 10 + len;
  }
  return found;
}

let probing = null; // { name, conflict }

const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

socket.on("message", (msg, from) => {
  try {
    if (msg.length < 12) return;
    if (msg.readUInt16BE(2) & 0x8000) {
      // An answer: while checking a name, notice another machine already using it.
      const mine = homeAddress();
      if (probing && addressesIn(msg, probing.name).some((ip) => ip !== mine)) probing.conflict = true;
      return;
    }
    if (probing) return; // not answering until the name is confirmed
    const count = msg.readUInt16BE(4);
    let pos = 12;
    for (let i = 0; i < count; i++) {
      const [qname, after] = readName(msg, pos);
      const qtype = msg.readUInt16BE(after);
      const qclass = msg.readUInt16BE(after + 2);
      pos = after + 4;
      if (qname !== NAME || (qtype !== 1 && qtype !== 255)) continue;
      const ip = homeAddress();
      if (!ip) return;
      if (from.port !== PORT) {
        // A simple ("legacy") lookup: answer the asker directly, echoing its question.
        const q = Buffer.concat([encodeName(NAME), msg.subarray(after, after + 4)]);
        socket.send(answer(ip, { id: msg.readUInt16BE(0), question: q, flush: false }), from.port, from.address);
      } else if (qclass & 0x8000) {
        socket.send(answer(ip), from.port, from.address); // asked for a direct reply
      } else {
        socket.send(answer(ip), PORT, GROUP);
      }
      return;
    }
  } catch {
    /* ignore malformed packets */
  }
});

socket.on("error", (err) => {
  console.error("local name:", err.message);
  process.exit(1);
});

/** Ask the network whether anyone else answers to `name`. */
async function nameIsFree(name) {
  probing = { name, conflict: false };
  const q = Buffer.concat([
    Buffer.from([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]),
    encodeName(name),
    Buffer.from([0, 1, 0, 1]),
  ]);
  for (let i = 0; i < 3 && !probing.conflict; i++) {
    socket.send(q, PORT, GROUP);
    await new Promise((r) => setTimeout(r, 400));
  }
  const free = !probing.conflict;
  probing = null;
  return free;
}

socket.bind(PORT, async () => {
  socket.addMembership(GROUP);
  socket.setMulticastTTL(255);
  for (let n = 1; n <= 9; n++) {
    const candidate = n === 1 ? `${BASE_NAME}.local` : `${BASE_NAME}-${n}.local`;
    if (await nameIsFree(candidate)) {
      NAME = candidate;
      break;
    }
    console.log(`${candidate} is already used by another machine on the network.`);
  }
  const ip = homeAddress();
  console.log(`Answering ${NAME} → ${ip ?? "(no home address yet)"}`);
  // Tell the network straight away (twice, as the standard suggests).
  if (ip) {
    socket.send(answer(ip), PORT, GROUP);
    setTimeout(() => socket.send(answer(homeAddress() ?? ip), PORT, GROUP), 1000);
  }
});
