import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import { api, type NotificationItem } from "../api";

const POLL_MS = 60_000;

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const LEVEL_COLOR: Record<NotificationItem["level"], string> = {
  info: "primary.main",
  warning: "warning.main",
  alert: "error.main",
};

/** Bell with the latest messages from plugins (and later from Nexternel itself). */
export function NotificationBell({ canClear }: { canClear?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.notifications(30);
    setItems(res.items);
    setUnread(res.unreadCount);
    setLastReadAt(res.lastReadAt);
  }, []);

  useEffect(() => {
    void load().catch(() => {});
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function open(el: HTMLElement) {
    setAnchor(el);
    await load().catch(() => {});
    if (unread > 0) {
      // Opening the list counts as reading it; the highlight stays until it closes.
      void api.markNotificationsRead().then(() => setUnread(0)).catch(() => {});
    }
  }

  function close() {
    setAnchor(null);
    void load().catch(() => {});
  }

  const isNew = (n: NotificationItem) => !lastReadAt || Date.parse(n.createdAt) > Date.parse(lastReadAt);

  return (
    <>
      <Tooltip title={unread ? `${unread} new notification${unread === 1 ? "" : "s"}` : "Notifications"}>
        <IconButton size="small" aria-label="Notifications" onClick={(e) => void open(e.currentTarget)} color="inherit">
          <Badge badgeContent={unread} color="error" max={99}>
            <NotificationsNoneRoundedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { width: "min(380px, calc(100vw - 32px))", maxHeight: "70vh" } } }}
      >
        <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
            Notifications
          </Typography>
          {canClear && items.length > 0 ? (
            <Button
              size="small"
              onClick={async () => {
                await api.clearNotifications().catch(() => {});
                await load().catch(() => {});
              }}
            >
              Clear all
            </Button>
          ) : null}
        </Stack>
        <Divider />
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No notifications yet.
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {items.map((n) => (
              <Box
                key={n.id}
                sx={{
                  px: 2,
                  py: 1.25,
                  borderLeft: 3,
                  borderColor: isNew(n) ? LEVEL_COLOR[n.level] : "transparent",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {n.title}
                </Typography>
                {n.body ? (
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                    {n.body}
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary">
                  {n.sourceName} · {ago(n.createdAt)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Popover>
    </>
  );
}
