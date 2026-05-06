import { createFileRoute } from "@tanstack/react-router";
import { AnmeldungForm } from "@/components/anmeldung/AnmeldungForm";
import { Logo } from "@/components/layout/Logo";

export const Route = createFileRoute("/anmeldung")({
  component: AnmeldungPage,
});

function AnmeldungPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background px-4 py-4 md:px-8">
        <Logo />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight">Mitglied werden</h1>
        <p className="mt-2 text-muted-foreground">
          Werde Teil unserer Energiegenossenschaft. Die Mitgliedschaft wird nach
          Eingang von 3 Bestätigungen und Zahlungseingang aktiv.
        </p>
        <div className="mt-8">
          <AnmeldungForm />
        </div>
      </main>
    </div>
  );
}