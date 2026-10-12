import { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, IconButton, InputBase, Stack, Typography, alpha } from "@mui/material";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import { api } from "../../api";

type Message = { role: "user" | "assistant"; text: string; error?: boolean };

const KEEP = 20;

function storageKey(panelId: string) {
  return `nexternel:conversation:${panelId}`;
}

function loadMessages(panelId: string): Message[] {
  try {
    const raw = sessionStorage.getItem(storageKey(panelId));
    const list = raw ? (JSON.parse(raw) as Message[]) : [];
    return Array.isArray(list) ? list.slice(-KEEP) : [];
  } catch {
    return [];
  }
}

function saveMessages(panelId: string, messages: Message[]) {
  try {
    sessionStorage.setItem(storageKey(panelId), JSON.stringify(messages.slice(-KEEP)));
  } catch {
    /* private window or storage full: the conversation just is not kept */
  }
}

/**
 * Conversation building block for plugin panels: type a question, the plugin's answer appears
 * as it is written. The conversation is kept for this browser tab only.
 */
export function ConversationPanel({
  pluginId,
  panelId,
  instanceId,
  placeholder = "Ask a question…",
}: {
  pluginId: string;
  panelId: string;
  /** The dashboard panel's own id, so two copies keep separate conversations. */
  instanceId: string;
  placeholder?: string;
}) {
  const [messages, setMessages] = useState<Message[]>(() => loadMessages(instanceId));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [waitedS, setWaitedS] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    saveMessages(instanceId, messages);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, instanceId]);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    setWaitedS(0);
    const timer = setInterval(() => setWaitedS(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  async function ask() {
    const text = draft.trim();
    if (!text || busy) return;
    const history = messages.filter((m) => !m.error).slice(-6).map(({ role, text: t }) => ({ role, text: t }));
    setDraft("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: "" }]);
    const show = (patch: Partial<Message>) =>
      alive.current &&
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { ...next[next.length - 1]!, ...patch };
        return next;
      });
    try {
      const { requestId } = await api.pluginPanelAsk(pluginId, panelId, text, history);
      let length = 0;
      for (;;) {
        const answer = await api.pluginPanelAnswer(requestId, length);
        if (!alive.current) return;
        if (answer.text.length !== length) {
          length = answer.text.length;
          show({ text: answer.text });
        }
        if (answer.error) {
          show({ text: answer.text ? `${answer.text}\n\n${answer.error}` : answer.error, error: true });
          break;
        }
        if (answer.done) break;
      }
    } catch (err) {
      show({ text: err instanceof Error ? err.message : "Could not ask the plugin", error: true });
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  const last = messages[messages.length - 1];
  const thinking = busy && last?.role === "assistant" && !last.text;

  return (
    <Stack sx={{ height: "100%", minHeight: 0, width: "100%" }}>
      <Box ref={listRef} sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, pt: 1.5, pb: 1 }}>
        {messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {placeholder}
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {messages.map((m, i) =>
              m.role === "user" ? (
                <Box
                  key={i}
                  sx={(theme) => ({
                    alignSelf: "flex-end",
                    maxWidth: "85%",
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.16),
                  })}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {m.text}
                  </Typography>
                </Box>
              ) : (
                <Typography
                  key={i}
                  variant="body2"
                  color={m.error ? "error.main" : "text.primary"}
                  sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {m.text}
                </Typography>
              )
            )}
            {thinking ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  {waitedS < 8 ? "Thinking…" : `Thinking… ${waitedS} s (the first question after a while can take a few minutes)`}
                </Typography>
              </Stack>
            ) : null}
          </Stack>
        )}
      </Box>
      <Stack
        direction="row"
        alignItems="flex-end"
        sx={{ borderTop: 1, borderColor: "divider", px: 1.5, py: 0.75, gap: 1 }}
      >
        <InputBase
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask();
            }
          }}
          placeholder={busy ? "Answering…" : "Type a question"}
          disabled={busy}
          multiline
          maxRows={3}
          inputProps={{ "aria-label": "Question", maxLength: 2000 }}
          sx={{ flex: 1, fontSize: "0.875rem", py: 0.5 }}
        />
        <IconButton
          size="small"
          color="primary"
          aria-label="Ask"
          disabled={busy || !draft.trim()}
          onClick={() => void ask()}
        >
          <ArrowUpwardRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}
