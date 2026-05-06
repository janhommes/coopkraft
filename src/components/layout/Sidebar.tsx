import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Coins,
  FileText,
  Megaphone,
  PiggyBank,
  FileDown,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { can } from "@/lib/permissions";
import { Logo } from "./Logo";

interface Item {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: boolean;
}

export function Sidebar() {
  const { user } = useAuth();
  const loc = useLocation();
  const items: Item[] = [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/app/mitglieder", label: "Mitglieder", icon: Users, show: can(user, "view:members") },
    { to: "/app/anteile", label: "Anteile", icon: Coins, show: can(user, "view:members") },
    { to: "/app/dokumente", label: "Dokumente", icon: FileText, show: true },
    { to: "/app/kommunikation", label: "Kommunikation", icon: Megaphone, show: can(user, "manage:campaigns") || !!user?.roles.includes("vorstand") },
    { to: "/app/dividenden", label: "Dividenden", icon: PiggyBank, show: can(user, "run:dividends") },
    { to: "/app/sepa", label: "SEPA-Lauf", icon: FileDown, show: can(user, "run:sepa") },
    { to: "/app/admin/branding", label: "Admin", icon: SettingsIcon, show: !!user?.roles.includes("admin") },
  ];
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="border-b p-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.filter((i) => i.show).map((i) => {
          const active = loc.pathname.startsWith(i.to);
          const Icon = i.icon;
          return (
            <Link
              key={i.to}
              to={i.to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              {i.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}