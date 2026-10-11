import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearStoredTokens, getStoredAccessToken, lastKnownUser, type User } from "../api";
import { USER_UPDATED_EVENT } from "../lib/user-events";

export function useShellAuth() {
  const navigate = useNavigate();
  const signedIn = Boolean(getStoredAccessToken());
  /** undefined = still loading /api/v1/auth/me (only before the first answer this visit) */
  const [user, setUser] = useState<User | null | undefined>(signedIn ? (lastKnownUser() ?? undefined) : null);

  useEffect(() => {
    if (!signedIn) {
      setUser(null);
      return;
    }

    let cancelled = false;
    let retryTimer: number | undefined;

    async function loadMe() {
      try {
        const r = await api.me();
        if (!cancelled) setUser(r.user);
      } catch {
        if (cancelled) return;
        // api.ts removes the stored login only when the server rejects it. A network blip,
        // an API restart, or a cancelled page load keeps the session: try again shortly.
        if (getStoredAccessToken()) {
          retryTimer = window.setTimeout(() => void loadMe(), 3000);
          return;
        }
        setUser(null);
        navigate("/login", { replace: true });
      }
    }

    void loadMe();

    function onUpdated() {
      void loadMe();
    }
    window.addEventListener(USER_UPDATED_EVENT, onUpdated);
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener(USER_UPDATED_EVENT, onUpdated);
    };
  }, [signedIn]);

  async function logout() {
    try {
      await api.logout();
    } finally {
      clearStoredTokens();
      setUser(null);
      navigate("/login");
    }
  }

  return {
    signedIn,
    user,
    authLoading: signedIn && user === undefined,
    isAdmin: Boolean(user?.isAdmin ?? user?.role === "admin"),
    permissions: user?.permissions ?? null,
    logout,
  };
}
