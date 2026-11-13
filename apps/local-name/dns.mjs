// Small multicast DNS helpers shared by the name answerer and the home network search.

export function encodeName(name) {
  const parts = name.split(".").map((l) => {
    const b = Buffer.from(l, "utf8");
    return Buffer.concat([Buffer.from([b.length]), b]);
  });
  return Buffer.concat([...parts, Buffer.from([0])]);
}

/** Read a (possibly compressed) name at offset; returns [name, next offset]. */
export function readName(buf, offset) {
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

/** Like readName, but keeps the original letters (device names such as "Garden Monitor"). */
export function readNameKeepCase(buf, offset) {
  const labels = [];
  let pos = offset;
  for (let guard = 0; guard < 64; guard++) {
    const len = buf[pos];
    if (len === undefined) throw new Error("short packet");
    if (len === 0) break;
    if ((len & 0xc0) === 0xc0) {
      pos = ((len & 0x3f) << 8) | buf[pos + 1];
      continue;
    }
    labels.push(buf.toString("utf8", pos + 1, pos + 1 + len));
    pos += 1 + len;
  }
  return labels.join(".");
}

export const TYPE_A = 1;
export const TYPE_PTR = 12;
export const TYPE_TXT = 16;
export const TYPE_SRV = 33;

/**
 * Every record in an answer packet (answers, authority and additional parts).
 * Returns [{ name, type, data }] where data depends on the type; unknown types are skipped.
 */
export function recordsIn(msg) {
  const out = [];
  let pos = 12;
  const qd = msg.readUInt16BE(4);
  const total = msg.readUInt16BE(6) + msg.readUInt16BE(8) + msg.readUInt16BE(10);
  for (let i = 0; i < qd; i++) pos = readName(msg, pos)[1] + 4;
  for (let i = 0; i < total && pos < msg.length; i++) {
    const [name, after] = readName(msg, pos);
    const type = msg.readUInt16BE(after);
    const ttl = msg.readUInt32BE(after + 4);
    const len = msg.readUInt16BE(after + 8);
    const start = after + 10;
    const end = start + len;
    if (end > msg.length) break;
    if (type === TYPE_A && len === 4) {
      out.push({ name, type, ttl, data: [...msg.subarray(start, end)].join(".") });
    } else if (type === TYPE_PTR) {
      out.push({ name, type, ttl, data: readNameKeepCase(msg, start) });
    } else if (type === TYPE_SRV && len >= 7) {
      out.push({ name, type, ttl, data: { port: msg.readUInt16BE(start + 4), target: readName(msg, start + 6)[0] } });
    } else if (type === TYPE_TXT) {
      const txt = {};
      let p = start;
      while (p < end) {
        const l = msg[p];
        const s = msg.toString("utf8", p + 1, Math.min(p + 1 + l, end));
        p += 1 + l;
        const eq = s.indexOf("=");
        const key = (eq < 0 ? s : s.slice(0, eq)).toLowerCase();
        if (key && key.length <= 40) txt[key] = eq < 0 ? "" : s.slice(eq + 1, eq + 1 + 200);
      }
      out.push({ name, type, ttl, data: txt });
    }
    pos = end;
  }
  return out;
}

/** One query packet asking for several names of one type (PTR for services, A for hosts). */
export function queryPacket(names, type) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(names.length, 4);
  const questions = names.map((n) => {
    const q = Buffer.alloc(4);
    q.writeUInt16BE(type, 0);
    q.writeUInt16BE(1, 2); // class IN
    return Buffer.concat([encodeName(n), q]);
  });
  return Buffer.concat([header, ...questions]);
}
