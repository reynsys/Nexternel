/** Human-friendly ESPHome device install copy and log helpers. */

export const ESPHOME_INSTALL_WORKFLOW_TITLE = "Getting your device online";

export const ESPHOME_INSTALL_STEPS = [
  {
    id: "register",
    title: "Device saved on this server",
    detail:
      "Nexternel registered the device and wrote its configuration. Nothing is on the ESP32 board yet.",
  },
  {
    id: "build",
    title: "Build firmware on the server",
    detail:
      "Click Build firmware. Nexternel compiles a .bin file on this server (the first build can take several minutes).",
  },
  {
    id: "usb",
    title: "Flash the ESP32 over USB",
    detail:
      "On your computer: download the .bin file, open ESPHome Web Installer, connect USB, and flash that file.",
  },
  {
    id: "online",
    title: "Device joins your home",
    detail:
      "Power the ESP32 on your Wi‑Fi. It should appear as Online on the Devices page within a few minutes.",
  },
] as const;

/** Recovery when ESPHome Web created a blank "ESPHome Web …" device on the chip. */
export const ESPHOME_WRONG_FLASH_RECOVERY = [
  'If ESPHome Web offered a new device named "ESPHome Web …", that is not your Nexternel device — do not adopt it.',
  "Connect USB again, open ESPHome Web Installer, click Connect, then Install, and select the .bin you downloaded from Nexternel.",
  'Do not click "New device" or "Prepare for first use".',
  "After flashing, power the board on your home Wi‑Fi. It should appear Online in Nexternel within a few minutes.",
] as const;

/** Shown after downloading the firmware .bin file. */
export const ESPHOME_USB_INSTALL_STEPS = [
  "Save the .bin file you just downloaded.",
  "Plug the ESP32 into this computer with a USB data cable.",
  "Open ESPHome Web Installer (button below) in Chrome or Edge.",
  "Click Connect and choose the USB port for your ESP32.",
  "Click Install, then browse and select the .bin file you downloaded.",
  'Do not click "New device" or "Prepare for first use" — those create a blank ESPHome Web device, not your Nexternel device.',
  "When flashing finishes, unplug USB and power the board on Wi‑Fi.",
  "Return to Nexternel → Devices — your device should show Online within a few minutes.",
] as const;

const COMPILE_LOG_SKIP = [
  /^installing /i,
  /^file .+ is already downloaded/i,
  /^extracting /i,
  /^selected targets are:/i,
  /^current system platform:/i,
  /^updating \/root\/\.cache/i,
  /^installing tools:/i,
];

const COMPILE_LOG_HIGHLIGHT = [
  /successfully compiled/i,
  /firmware\.factory\.bin/i,
  /^failed config/i,
  /compilation failed/i,
  /ninja: build stopped/i,
  /^warning\b/i,
  /^info\b/i,
  /ram:/i,
  /^flash:/i,
];

function trimLogTail(log: string, maxLines = 40): string {
  const lines = log.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length <= maxLines) return lines.join("\n");
  return ["… earlier output hidden …", ...lines.slice(-maxLines)].join("\n");
}

/** Keep in sync with apps/api/src/esphome/cli-log.ts */
const COMPILE_SUCCESS = [
  /Successfully compiled program/i,
  /Created:.*firmware\.factory\.bin/i,
];

const COMPILE_FAILURE_LINE = [
  /^Failed config/i,
  /Compilation failed/i,
  /ninja: build stopped/i,
  /fatal error:/i,
  /^ERROR\b/i,
];

function compileLogSucceeded(text: string): boolean {
  return COMPILE_SUCCESS.some((re) => re.test(text));
}

function lastMatchingLineIndex(log: string, patterns: RegExp[]): number {
  const lines = log.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]?.trim() ?? "";
    if (!t) continue;
    if (patterns.some((re) => re.test(t))) return i;
  }
  return -1;
}

function compileLogFailed(text: string): boolean {
  if (compileLogSucceeded(text)) return false;
  const successIdx = lastMatchingLineIndex(text, COMPILE_SUCCESS);
  const failureIdx = lastMatchingLineIndex(text, COMPILE_FAILURE_LINE);
  if (failureIdx >= 0 && successIdx > failureIdx) return false;
  if (failureIdx >= 0) return true;
  return text.split(/\r?\n/).some((line) => {
    const t = line.trim();
    if (!t) return false;
    return COMPILE_FAILURE_LINE.some((re) => re.test(t));
  });
}

export function summarizeEsphomeCompileLog(log: string): {
  ok: boolean;
  headline: string;
  detail: string;
  technicalLog: string;
} {
  const text = log.trim();
  const lower = text.toLowerCase();
  const built = compileLogSucceeded(text);
  const failed = compileLogFailed(text);

  const filtered = text
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      return !COMPILE_LOG_SKIP.some((re) => re.test(t));
    })
    .filter((line, i, arr) => line !== arr[i - 1]);

  const highlights = filtered.filter((line) =>
    COMPILE_LOG_HIGHLIGHT.some((re) => re.test(line))
  );
  const technicalLog = trimLogTail(
    highlights.length > 0 ? highlights.join("\n") : filtered.join("\n")
  );

  if (!text) {
    return {
      ok: false,
      headline: "No build output yet.",
      detail: "Click Build firmware to start.",
      technicalLog: "",
    };
  }
  if (built) {
    return {
      ok: true,
      headline: "Firmware built successfully.",
      detail: "Download the .bin file below and flash it with ESPHome Web Installer.",
      technicalLog,
    };
  }
  if (failed) {
    const timedOut =
      /timed out/i.test(lower) ||
      (/checking esp-idf/i.test(lower) && !built);
    return {
      ok: false,
      headline: timedOut ? "Firmware build timed out." : "Firmware build failed.",
      detail: timedOut
        ? "The first ESP-IDF build on this server can take 15–20 minutes. Try Build firmware again, or compile from the ESPHome dashboard and download the .bin from there."
        : "Check the technical log below, fix the device configuration if needed, then try again.",
      technicalLog,
    };
  }
  if (lower.includes("compiling") || lower.includes("building")) {
    return {
      ok: false,
      headline: "Building firmware…",
      detail: "This can take several minutes, especially the first time on this server.",
      technicalLog,
    };
  }
  return {
    ok: false,
    headline: "Build finished.",
    detail: "Review the log below if the result is not what you expected.",
    technicalLog,
  };
}

export function summarizeEsphomeUploadLog(log: string): {
  ok: boolean;
  headline: string;
  detail: string;
  technicalLog: string;
} {
  const text = log.trim();
  const lower = text.toLowerCase();
  const failed =
    /upload failed/i.test(lower) ||
    /^failed config/i.test(lower) ||
    /ninja: build stopped/i.test(lower);
  const ok =
    !failed &&
    (lower.includes("successfully") ||
      lower.includes("uploaded") ||
      lower.includes("done"));

  const technicalLog = trimLogTail(text, 30);

  if (!text) {
    return {
      ok: false,
      headline: "No update output yet.",
      detail: "Use this only when the ESP32 already runs Nexternel firmware and is on your Wi‑Fi.",
      technicalLog: "",
    };
  }
  if (failed) {
    return {
      ok: false,
      headline: "Over-the-air update failed.",
      detail:
        "The device may be offline or still on old firmware. For a new board, use USB flash (Step 2) instead.",
      technicalLog,
    };
  }
  if (ok) {
    return {
      ok: true,
      headline: "Update sent to the device.",
      detail: "The ESP32 will restart. It should show Online in Devices within a few minutes.",
      technicalLog,
    };
  }
  return {
    ok: false,
    headline: "Update in progress…",
    detail: "Wait for the device to restart.",
    technicalLog,
  };
}

/** Map device lifecycle to install workflow step index (0-based). */
export function esphomeInstallActiveStep(lifecycle: string | null | undefined): number {
  switch (lifecycle) {
    case "configured":
    case "validation_failed":
    case "ready_to_build":
    case "awaiting_installation":
      return 1;
    case "building":
      return 1;
    case "firmware_ready":
      return 2;
    case "connecting":
      return 3;
    case "online":
      return 4;
    default:
      return 1;
  }
}

export const ESPHOME_WEB_INSTALLER_URL = "https://web.esphome.io";
