import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnmeldungForm } from "@/components/anmeldung/AnmeldungForm";
import { Logo } from "@/components/layout/Logo";
import { getSettings } from "@/services/settings.service";

export const Route = createFileRoute("/anmeldung")({
  component: AnmeldungPage,
});

function AnmeldungPage() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const showLogo = settings?.signup?.showLogo ?? true;
  const intro = settings?.signup?.intro;
  const customCss = settings?.signup?.customCss;
  const title = settings?.signup?.title || "Mitglied werden";
  return (
    <div className="signup-page min-h-screen bg-muted/30">
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}
      {showLogo && (
        <header className="signup-header border-b bg-background px-4 py-4 md:px-8">
          <Logo />
        </header>
      )}
      <main className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <h1 className="signup-title text-3xl font-bold tracking-tight">{title}</h1>
        {intro && (
          <div className="signup-intro mt-2 whitespace-pre-line text-muted-foreground">{intro}</div>
        )}
        <div className="mt-8">
          <AnmeldungForm />
        </div>
      </main>
    </div>
  );
}