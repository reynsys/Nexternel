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
import { useLocation } from "react-router-dom";
import { api, type NotificationItem } from "../api";
import { useOptionalSkin } from "../skins/SkinProvider";
import { normalizeBellPrefs } from "../skins/themePrefs";
import { useStatusLightPrefs } from "./status-light/StatusLight";
import { useLiveChanges } from "../lib/live-changes";

const POLL_MS = 60_000;

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Pages that show the dashboard tabs (and the Dashboard Options cog). */
export function isDashboardRoute(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/d/") || pathname.startsWith("/dashboards/");
}

const LEVEL_COLOR: Record<NotificationItem["level"], string> = {
  info: "primary.main",
  warning: "warning.main",
  alert: "error.main",
};

/**
 * Bell with the latest messages from Nexternel and plugins. Its counter takes the status-light
 * colour of the most important unread message: accent for information, amber, red only for
 * "act now". Each person chooses in Settings → Notifications whether it shows (always, only with
 * new messages, never) and where: `place` says where this copy sits. "menu" = top of the side menu,
 * "menu-bottom" = bottom of the side menu beside the person's name, "dashboard" = with the
 * dashboard tools (beside the Dashboard Options cog; other pages keep it at the top of the side
 * menu). "bar" (phone top bar, top-menu layout) shows whenever the bell is on.
 */
export function NotificationBell({
  canClear,
  place = "bar",
  tip,
}: {
  canClear?: boolean;
  /** "phone-menu": a Messages button inside the phone's menu, for people whose bell is off (Never). */
  place?: "menu" | "menu-bottom" | "dashboard" | "bar" | "phone-menu";
  /** Where its name shows when pointed at (left in the rail, so it never covers the next button). */
  tip?: "left";
}) {
  const skin = useOptionalSkin();
  const prefs = normalizeBellPrefs(skin?.themePrefs.bell);
  const lights = useStatusLightPrefs();
  const { pathname } = useLocation();
  const onDashboard = isDashboardRoute(pathname);
  const here =
    place === "phone-menu"
      ? prefs.show === "never"
      : prefs.show !== "never" &&
    (place === "bar" ||
      (place === "dashboard" && prefs.position === "top") ||
      (place === "menu" && (prefs.position === "menu" || (prefs.position === "top" && !onDashboard))) ||
      (place === "menu-bottom" && prefs.position === "menu-bottom"));
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [unreadLevel, setUnreadLevel] = useState<NotificationItem["level"] | null>(null);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.notifications(30);
    setItems(res.items);
    setUnread(res.unreadCount);
    setUnreadLevel(res.unreadLevel ?? (res.unreadCount ? "info" : null));
    setLastReadAt(res.lastReadAt);
  }, []);

  useLiveChanges(["notifications"], () => void load().catch(() => {}), here);

  useEffect(() => {
    if (!here) return;
    void load().catch(() => {});
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load, here]);

  const badgeColour =
    unreadLevel === "alert" ? lights.colours.alert : unreadLevel === "warning" ? lights.colours.watch : "primary.main";

  async function open(el: HTMLElement) {
    setAnchor(el);
    await load().catch(() => {});
    if (unread > 0) {
      // Opening the list counts as reading it; the highlight stays until it closes.
      void api
        .markNotificationsRead()
        .then(() => {
          setUnread(0);
          setUnreadLevel(null);
        })
        .catch(() => {});
    }
  }

  function close() {
    setAnchor(null);
    void load().catch(() => {});
  }

  const isNew = (n: NotificationItem) => !lastReadAt || Date.parse(n.createdAt) > Date.parse(lastReadAt);
  const lineColour = (n: NotificationItem) =>
    n.level === "alert" ? lights.colours.alert : n.level === "warning" ? lights.colours.watch : LEVEL_COLOR.info;

  if (!here) return null;
  // "Only when there are new messages": hidden while there is nothing new, unless the list is open.
  if (place !== "phone-menu" && prefs.show === "new" && unread === 0 && !anchor) return null;

  return (
    <>
      {place === "phone-menu" ? (
        // The bell is off: the messages are still one tap away in the menu, with their count.
        <Button
          fullWidth
          variant="outlined"
          startIcon={<NotificationsNoneRoundedIcon />}
          onClick={(e) => void open(e.currentTarget)}
          endIcon={
            unread ? (
              <Typography component="span" variant="caption" sx={{ minWidth: 20, height: 20, px: 0.75, borderRadius: 10, bgcolor: badgeColour, color: "#fff", fontWeight: "fontWeightBold", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {unread > 99 ? "99+" : unread}
              </Typography>
            ) : undefined
          }
          sx={{ justifyContent: "flex-start", "& .MuiButton-endIcon": { ml: "auto" } }}
        >
          Messages
        </Button>
      ) : (
      <Tooltip title={unread ? `${unread} new notification${unread === 1 ? "" : "s"}` : "Notifications"} placement={tip}>
        <IconButton size="small" aria-label="Notifications" onClick={(e) => void open(e.currentTarget)} color="inherit">
          <Badge
            badgeContent={unread}
            max={99}
            sx={{ "& .MuiBadge-badge": { bgcolor: badgeColour, color: "#fff", fontWeight: "fontWeightBold" } }}
          >
            <NotificationsNoneRoundedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>
      )}
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: place === "dashboard" ? "right" : "left" }}
        transformOrigin={{ vertical: "top", horizontal: place === "dashboard" ? "right" : "left" }}
        slotProps={{ paper: { sx: { width: "min(380px, calc(100vw - 32px))", maxHeight: "70vh" } } }}
      >
        <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: "fontWeightBold", flex: 1 }}>
            Notifications
          </Typography>
          {canClear && items.length > 0 ? (
            <Button
              size="small"
              variant="outlined"
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
                  borderColor: isNew(n) ? lineColour(n) : "transparent",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: "fontWeightBold" }}>
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


/**
 * The colour of the dot on the phone's menu button: shown only while the bell is off (Never) and there are
 * new messages, so new messages are never missed. Null when there is no dot.
 */
export function useMenuDot(): string | null {
  const skin = useOptionalSkin();
  const prefs = normalizeBellPrefs(skin?.themePrefs.bell);
  const lights = useStatusLightPrefs();
  const watching = prefs.show === "never";
  const [state, setState] = useState<{ unread: number; level: NotificationItem["level"] | null }>({ unread: 0, level: null });
  const load = useCallback(async () => {
    const res = await api.notifications(1);
    setState({ unread: res.unreadCount, level: res.unreadLevel ?? (res.unreadCount ? "info" : null) });
  }, []);
  useLiveChanges(["notifications"], () => void load().catch(() => {}), watching);
  useEffect(() => {
    if (!watching) return;
    void load().catch(() => {});
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load, watching]);
  if (!watching || state.unread === 0) return null;
  return state.level === "alert" ? lights.colours.alert : state.level === "warning" ? lights.colours.watch : "primary.main";
}
