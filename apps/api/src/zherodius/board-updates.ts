/**
 * Zherodius devices in the shared board updates (devices/board-updates.ts): each one with the version it
 * runs and the newer one its own update check found; an update is asked over its direct line (updates.ts).
 */
import { recentDrops, registerBoardKind } from "../devices/board-updates.js";
import { zherodius } from "./service.js";
import { listVersions } from "./store.js";
import { createZherodiusUpdater, zherodiusBoardStatus } from "./updates.js";

registerBoardKind("zherodius", {
  async list() {
    const out = [];
    for (const d of await listVersions()) {
      const connected = zherodius.isOpen(d.deviceId);
      out.push(
        zherodiusBoardStatus({
          deviceId: d.deviceId,
          name: d.name,
          version: (connected ? zherodius.hello(d.deviceId)?.version : null) ?? d.version,
          connected,
          update: zherodius.updateOf(d.deviceId),
          recentDrops: await recentDrops(d.deviceId),
        })
      );
    }
    return out;
  },
  update: createZherodiusUpdater({ conn: zherodius }),
});
