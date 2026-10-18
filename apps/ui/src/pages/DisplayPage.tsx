import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
import { DashboardPage } from "./DashboardPage";
import { api } from "../api";
import { dashboardPaths } from "../lib/dashboard-path";
import { NOT_DISPLAY, displayPath, parseDisplayOptions, setDisplayMode, useDisplayMode } from "../lib/display-mode";

/**
 * Display mode (/display, /display/<name>): the dashboard alone, full screen, for wall displays and
 * tablets. Changes made elsewhere show by themselves (live changes); the pointer hides when idle;
 * Esc goes back to the normal dashboard.
 */
export function DisplayPage() {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  const display = useDisplayMode();
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    setDisplayMode(parseDisplayOptions(search));
  }, [search]);
  useEffect(() => () => setDisplayMode(NOT_DISPLAY), []);

  useEffect(() => {
    if (display.light) document.documentElement.setAttribute("data-nx-light", "");
    else document.documentElement.removeAttribute("data-nx-light");
    return () => document.documentElement.removeAttribute("data-nx-light");
  }, [display.light]);

  // Hide the pointer after a few seconds without moving it.
  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), 3000);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), 3000);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", onKey);
    };
  }, [navigate]);

  // Optional: move to the next dashboard every `rotate` seconds, in tab order.
  useEffect(() => {
    if (!display.rotate) return undefined;
    const timer = window.setTimeout(() => {
      void api.dashboards().then(({ dashboards }) => {
        if (!dashboards.length) return;
        const paths = [...dashboardPaths(dashboards).values()].map(displayPath);
        const here = paths.indexOf(pathname.replace(/\/$/, "") || "/display");
        navigate(paths[(here + 1) % paths.length] + search);
      });
    }, display.rotate * 1000);
    return () => window.clearTimeout(timer);
  }, [display.rotate, pathname, search, navigate]);

  return (
    <Box
      component="main"
      sx={{ minHeight: "100vh", boxSizing: "border-box", p: { xs: 1.5, md: 2.5 }, cursor: idle ? "none" : "auto" }}
    >
      {display.active ? <DashboardPage /> : null}
    </Box>
  );
}
