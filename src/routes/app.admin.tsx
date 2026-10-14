import { createFileRoute, Outlet, Link, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
});

type AdminItem = { to: string; label: string };
type AdminGroup = { label: string; items: AdminItem[] };

const groups: AdminGroup[] = [
  {
    label: "Auftritt",
    items: [
      { to: "/app/admin/branding", label: "Branding" },
      { to: "/app/admin/anmeldung", label: "Beitrittsformular" },
      { to: "/app/admin/newsletter", label: "Newsletter" },
    ],
  },
  {
    label: "Mitglieder & Anteile",
    items: [
      { to: "/app/admin/anteile", label: "Anteile" },
      { to: "/app/admin/felder", label: "Benutzerdefinierte Felder" },
    ],
  },
  {
    label: "Finanzen",
    items: [
      { to: "/app/admin/konto", label: "Bankkonto" },
      { to: "/app/admin/stammdaten", label: "Stammdaten" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/app/admin/workflow", label: "Workflows & Kündigung" },
      { to: "/app/admin/users", label: "Rollen & SSO" },
      { to: "/app/admin/datenbank", label: "Datenbank & Sicherung" },
    ],
  },
];

const allItems: AdminItem[] = groups.flatMap((g) => g.items);

function AdminLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const current = allItems.find((i) => i.to === loc.pathname) ?? allItems[0];

  return (
    <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      {/* Desktop/Tablet: senkrechte Unter-Navigation als zweite Spalte */}
      <nav
        aria-label="Administration"
        className="hidden self-start md:sticky md:top-6 md:block md:max-h-[calc(100vh-3rem)] md:overflow-y-auto md:pb-2"
      >
        <div className="space-y-5 pr-2">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((i) => {
                  const active = loc.pathname === i.to;
                  return (
                    <li key={i.to}>
                      <Link
                        to={i.to}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-md border-l-2 px-3 py-2 text-sm leading-snug transition-colors ${
                          active
                            ? "border-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "border-transparent hover:bg-accent"
                        }`}
                      >
                        {i.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Administration
          </p>
          <h1 className="text-2xl font-bold">{current.label}</h1>
        </div>

        {/* Mobil: Select */}
        <div className="md:hidden">
          <Select value={current.to} onValueChange={(v) => navigate({ to: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectGroup key={g.label}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.items.map((i) => (
                    <SelectItem key={i.to} value={i.to}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Outlet />
      </div>
    </div>
  );
}

export { redirect };
