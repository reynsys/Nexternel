export type CopyTextResult =
  | { ok: true }
  | { ok: false; error: string };

/** Copy text on LAN HTTP where navigator.clipboard may be blocked (non-secure context). */
export async function copyTextToClipboard(text: string): Promise<CopyTextResult> {
  const value = text.trim();
  if (!value) {
    return { ok: false, error: "Nothing to copy" };
  }

  const execCopy = (): boolean => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.width = "2px";
      ta.style.height = "2px";
      ta.style.padding = "0";
      ta.style.border = "none";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  // Prefer execCommand on LAN HTTP — Clipboard API often requires secure context.
  if (!window.isSecureContext) {
    if (execCopy()) return { ok: true };
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (err) {
      if (execCopy()) return { ok: true };
      const message = err instanceof Error ? err.message : "Clipboard API denied";
      return { ok: false, error: message };
    }
  }

  if (execCopy()) return { ok: true };
  return { ok: false, error: "Clipboard not available in this browser" };
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
