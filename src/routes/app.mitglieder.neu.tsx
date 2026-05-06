import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnmeldungForm } from "@/components/anmeldung/AnmeldungForm";

export const Route = createFileRoute("/app/mitglieder/neu")({
  component: NeuPage,
});

function NeuPage() {
  const _nav = useNavigate();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Neues Mitglied anlegen</h1>
      <p className="text-sm text-muted-foreground">Manuelle Anlage durch Mitgliederverwalter. Verwendet das gleiche Formular wie die öffentliche Anmeldung.</p>
      <AnmeldungForm />
    </div>
  );
}