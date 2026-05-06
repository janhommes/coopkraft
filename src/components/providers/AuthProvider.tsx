import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { listUsers } from "@/services/users.service";
import type { AppUser, Role } from "@/lib/types";
import { hasAnyRole as hAny, hasRole as hRole } from "@/lib/permissions";

interface AuthCtx {
  user: AppUser | null;
  users: AppUser[];
  switchUser: (id: string | null) => void;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  isAuthenticated: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

const STORAGE_KEY = "demo-active-user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const usersQ = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  // Default-User: greta
  useEffect(() => {
    if (usersQ.data && usersQ.data.length > 0 && !activeId) {
      const greta = usersQ.data.find((u) => u.id === "u-greta") ?? usersQ.data[0];
      setActiveId(greta.id);
      try {
        window.localStorage.setItem(STORAGE_KEY, greta.id);
      } catch {
        /* noop */
      }
    }
  }, [usersQ.data, activeId]);

  const user = (usersQ.data ?? []).find((u) => u.id === activeId) ?? null;

  const value: AuthCtx = {
    user,
    users: usersQ.data ?? [],
    switchUser: (id) => {
      setActiveId(id);
      try {
        if (id) window.localStorage.setItem(STORAGE_KEY, id);
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
    },
    hasRole: (r) => hRole(user, r),
    hasAnyRole: (rs) => hAny(user, rs),
    isAuthenticated: !!user,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}