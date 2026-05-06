import { createFileRoute, Outlet, Link, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
});

const items = [
  { to: "/app/admin/branding", label: "Branding" },
  { to: "/app/admin/anmeldung", label: "Beitrittsformular" },
  { to: "/app/admin/newsletter", label: "Newsletter" },
  { to: "/app/admin/anteile", label: "Anteile" },
   { to: "/app/admin/felder", label: "Benutzerdefinierte Felder" },
  { to: "/app/admin/konto", label: "Bankkonto" },
  { to: "/app/admin/stammdaten", label: "Stammdaten" },
  { to: "/app/admin/workflow", label: "Workflows & Kündigung" },
  { to: "/app/admin/users", label: "Benutzer & Rollen" },
] as const;

function AdminLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  const updateOverflow = () => {
    const el = scrollerRef.current; if (!el) return;
    setOverflow({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  };

  useEffect(() => {
    updateOverflow();
    const el = scrollerRef.current; if (!el) return;
    const onScroll = () => updateOverflow();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateOverflow);
    return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("resize", updateOverflow); };
  }, []);

  // Scroll the active tab into view when the route changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    requestAnimationFrame(updateOverflow);
  }, [loc.pathname]);

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  const current = items.find((i) => i.to === loc.pathname)?.to ?? items[0].to;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Administration</h1>

      {/* Mobil: Select */}
      <div className="md:hidden">
        <Select value={current} onValueChange={(v) => navigate({ to: v })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.to} value={i.to}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop/Tablet: scrollbare Tab-Leiste mit Pfeilen */}
      <div className="relative hidden border-b md:block">
        {overflow.left && (
          <button
            type="button"
            aria-label="Nach links scrollen"
            onClick={() => scrollBy(-200)}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-background p-1 shadow-sm hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {overflow.right && (
          <button
            type="button"
            aria-label="Nach rechts scrollen"
            onClick={() => scrollBy(200)}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-background p-1 shadow-sm hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        <nav
          ref={scrollerRef}
          className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingLeft: overflow.left ? 28 : 0, paddingRight: overflow.right ? 28 : 0 }}
        >
          {items.map((i) => {
            const active = loc.pathname === i.to;
            return (
              <Link
                key={i.to}
                to={i.to}
                ref={active ? activeRef : undefined}
                className={`shrink-0 whitespace-nowrap rounded px-3 py-1.5 text-sm ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {i.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}

export { redirect };