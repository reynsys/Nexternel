import { useEffect, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import {
  filterNav,
  MAIN_NAV,
  navItemActive,
  SECONDARY_NAV,
  type NavItem,
} from "../../nav";
import type { RolePermissions } from "../../../lib/permissions";

type Props = {
  signedIn: boolean;
  isAdmin: boolean;
  permissions?: RolePermissions | null;
  authLoading?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
};

/** True when `pathname` is one of the group's own pages. */
function childActive(child: NavItem, pathname: string): boolean {
  return pathname === child.to || pathname.startsWith(`${child.to}/`);
}

/** One menu entry: icon and name (a folded menu shows only the icon). */
function NavButton({
  item,
  collapsed,
  selected,
  within,
  child,
  onNavigate,
  group,
}: {
  item: NavItem;
  collapsed?: boolean;
  selected: boolean;
  /** The entry of a group whose page is open: marked, not filled (only the page itself is filled). */
  within?: boolean;
  /** A page inside a group. */
  child?: boolean;
  onNavigate?: () => void;
  /** A group's entry: opens or closes its pages (and goes to the first one from elsewhere). */
  group?: { open: boolean; listId: string; onClick: () => void };
}) {
  const Icon = item.icon;
  const link = group ? {} : { component: RouterLink, to: item.to };
  return (
    <ListItemButton
      {...link}
      onClick={group ? group.onClick : onNavigate}
      selected={selected}
      aria-current={selected ? "page" : undefined}
      aria-expanded={group ? group.open : undefined}
      aria-controls={group ? group.listId : undefined}
      data-nx-nav=""
      data-nx-nav-within={within ? "" : undefined}
      data-nx-nav-child={child ? "" : undefined}
      sx={{ justifyContent: collapsed ? "center" : "flex-start", px: collapsed ? 1 : child ? 1 : 2 }}
    >
      <ListItemIcon sx={{ minWidth: collapsed ? 0 : child ? 26 : 36, justifyContent: "center", color: "inherit" }}>
        <Icon fontSize="small" />
      </ListItemIcon>
      {!collapsed && <ListItemText primary={item.label} primaryTypographyProps={child ? { variant: "body2" } : undefined} />}
      {group && !collapsed ? (
        <ExpandMoreRoundedIcon fontSize="small" sx={{ ml: 1, transition: "transform 150ms", transform: group.open ? "rotate(180deg)" : "none" }} />
      ) : null}
    </ListItemButton>
  );
}

/** The pages of a group, for the pop-out list of a folded menu. */
function GroupPopout({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  return (
    <Box sx={{ minWidth: 200 }}>
      <Typography variant="overline" color="text.secondary" component="div" sx={{ px: 1, pb: 0.5 }}>
        {item.label}
      </Typography>
      <List dense disablePadding>
        {item.children!.map((c) => (
          <ListItem key={c.to} disablePadding sx={{ display: "block" }}>
            <NavButton item={c} child selected={childActive(c, pathname)} onNavigate={onNavigate} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

function NavList({
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  // A group is open while one of its pages is open. Its entry goes to its first page from elsewhere,
  // and opens or closes the group while inside it (until the next page change).
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  useEffect(() => setToggled({}), [pathname]);

  return (
    <List dense>
      {items.map((item) => {
        const active = navItemActive(item, pathname);
        const group = item.children?.length ? item : null;

        if (!group) {
          const button = <NavButton item={item} collapsed={collapsed} selected={active} onNavigate={onNavigate} />;
          return (
            <ListItem key={item.to} disablePadding sx={{ display: "block" }}>
              {collapsed ? (
                <Tooltip title={item.label} placement="right">
                  <span>{button}</span>
                </Tooltip>
              ) : (
                button
              )}
            </ListItem>
          );
        }

        // A folded menu: the group's icon, with its pages in a list that pops out beside it.
        if (collapsed) {
          return (
            <ListItem key={item.to} disablePadding sx={{ display: "block" }}>
              <Tooltip
                placement="right-start"
                title={<GroupPopout item={group} pathname={pathname} onNavigate={onNavigate} />}
                slotProps={{ tooltip: { className: "nx-nav-popout" } }}
              >
                <span>
                  <NavButton item={item} collapsed selected={active} onNavigate={onNavigate} />
                </span>
              </Tooltip>
            </ListItem>
          );
        }

        const open = toggled[item.to] ?? active;
        const listId = `nx-nav-group-${item.to.replace(/[^a-z0-9]+/gi, "-")}`;
        return (
          <ListItem key={item.to} disablePadding sx={{ display: "block" }}>
            <NavButton
              item={item}
              selected={false}
              within={active}
              group={{
                open,
                listId,
                onClick: () => {
                  if (active) setToggled((t) => ({ ...t, [item.to]: !open }));
                  else {
                    navigate(item.to);
                    onNavigate?.();
                  }
                },
              }}
            />
            <Collapse in={open} timeout="auto">
              {/* The group's pages, indented, joined to it by a line down the left. */}
              <List id={listId} dense disablePadding data-nx-nav-group="">
                {group.children!.map((c) => (
                  <ListItem key={c.to} disablePadding sx={{ display: "block" }}>
                    <NavButton item={c} child selected={childActive(c, pathname)} onNavigate={onNavigate} />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </ListItem>
        );
      })}
    </List>
  );
}


export function MenuContent({
  signedIn,
  isAdmin,
  permissions,
  authLoading = false,
  collapsed = false,
  onNavigate,
}: Props) {
  const { pathname } = useLocation();
  const main = filterNav(MAIN_NAV, { signedIn, isAdmin, permissions, authLoading });
  const secondary = filterNav(SECONDARY_NAV, { signedIn, isAdmin, permissions, authLoading });

  return (
    <Stack sx={{ flexGrow: 1, p: 1, justifyContent: "space-between" }}>
      <NavList
        items={main}
        pathname={pathname}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavList
        items={secondary}
        pathname={pathname}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    </Stack>
  );
}
