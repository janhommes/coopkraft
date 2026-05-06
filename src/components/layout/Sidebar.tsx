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
  Menu,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { can } from "@/lib/permissions";
import { Logo } from "./Logo";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface Item {
  to: string;
  match?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: boolean;
}

function useSidebarItems(): Item[] {
  const { user } = useAuth();
  return [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/app/mitglieder", label: "Mitglieder", icon: Users, show: can(user, "view:members") },
    { to: "/app/anteile", label: "Anteile", icon: Coins, show: can(user, "view:members") },
    { to: "/app/dokumente", label: "Dokumente", icon: FileText, show: true },
    { to: "/app/kommunikation", label: "Kommunikation", icon: Megaphone, show: can(user, "manage:campaigns") || !!user?.roles.includes("vorstand") },
    { to: "/app/dividenden", label: "Dividenden", icon: PiggyBank, show: can(user, "run:dividends") },
    { to: "/app/sepa", label: "SEPA-Lauf", icon: FileDown, show: can(user, "run:sepa") },
    { to: "/app/admin/branding", match: "/app/admin", label: "Admin", icon: SettingsIcon, show: !!user?.roles.includes("admin") },
  ];
}

function NavList({ items, onNavigate }: { items: Item[]; onNavigate?: () => void }) {
  const loc = useLocation();
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {items.filter((i) => i.show).map((i) => {
        const active = loc.pathname.startsWith(i.match ?? i.to);
        const Icon = i.icon;
        return (
          <Link
            key={i.to}
            to={i.to}
            onClick={onNavigate}
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
  );
}

export function Sidebar() {
  const items = useSidebarItems();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="border-b p-4">
        <Logo />
      </div>
      <NavList items={items} />
    </aside>
  );
}

export function MobileSidebarTrigger() {
  const items = useSidebarItems();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Navigation öffnen">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar p-0 text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="border-b p-4">
          <Logo />
        </div>
        <NavList items={items} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}