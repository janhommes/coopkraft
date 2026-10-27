import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Sidebar, MobileSidebarTrigger } from "@/components/layout/Sidebar";
import { UserSwitcher } from "@/components/layout/UserSwitcher";
import { useAuth } from "@/components/providers/AuthProvider";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, mode, loading, login, logout } = useAuth();
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Logo className="justify-center" />
          {mode === "sso" ? (
            loading ? (
              <p className="mt-4 text-muted-foreground">Lade Anmeldung…</p>
            ) : (
              <Button className="mt-4" onClick={login}>
                Anmelden
              </Button>
            )
          ) : (
            <p className="mt-4 text-muted-foreground">Bitte oben rechts einen Demo-Benutzer wählen.</p>
          )}
        </div>
      </div>
    );
  }
  if (mode === "sso" && user.roles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Logo className="justify-center" />
          <p className="mt-4 text-muted-foreground">
            Für {user.email} ist kein Zugang eingerichtet. Bitte wende dich an den Vorstand.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => void logout()}>
            Abmelden
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <MobileSidebarTrigger />
            <Logo />
          </div>
          <div className="hidden md:block" />
          <UserSwitcher />
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}