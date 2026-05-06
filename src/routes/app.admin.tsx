import { createFileRoute, Outlet, Link, useLocation, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
});

const items = [
  { to: "/app/admin/branding", label: "Branding" },
  { to: "/app/admin/anteile", label: "Anteile" },
   { to: "/app/admin/felder", label: "Benutzerdefinierte Felder" },
  { to: "/app/admin/konto", label: "Bankkonto" },
  { to: "/app/admin/workflow", label: "Workflows & Kündigung" },
  { to: "/app/admin/users", label: "Benutzer & Rollen" },
] as const;

function AdminLayout() {
  const loc = useLocation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Administration</h1>
      <nav className="flex flex-wrap gap-2 border-b pb-2">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className={`rounded px-3 py-1.5 text-sm ${loc.pathname === i.to ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            {i.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

export { redirect };