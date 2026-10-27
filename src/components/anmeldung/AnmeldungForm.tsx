import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { getSettings } from "@/services/settings.service";
import { listCustomFields, validateCustomFields } from "@/services/customFields.service";
import { submitAnmeldung } from "@/services/members.service";
import { isValidIban } from "@/services/sepa.service";
import { LAND_LABELS, formatEuro } from "@/lib/locale";
import type { Anrede, CustomFieldDef, Kontakttyp, Land } from "@/lib/types";

const stepLabels = ["Persönlich", "Adresse", "Bank", "Anteile", "Bestätigung"];

interface FormState {
  typ: Kontakttyp;
  anrede: Anrede;
  titel: string;
  vorname: string;
  nachname: string;
  firma: string;
  geburtsdatum: string;
  email: string;
  telefon: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: Land;
  iban: string;
  bic: string;
  kontoinhaber: string;
  anteile: number;
  newsletter: boolean;
  satzungAkzeptiert: boolean;
  custom: Record<string, unknown>;
}

export function AnmeldungForm({ compact = false, layoutOverride }: { compact?: boolean; layoutOverride?: "stepper" | "single" }) {
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const cfQ = useQuery({ queryKey: ["customFields"], queryFn: listCustomFields });
  const qc = useQueryClient();
  const settings = settingsQ.data;
  const layout: "stepper" | "single" = layoutOverride ?? settings?.signup?.layout ?? "stepper";
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<{ name: string; nummer: number } | null>(null);
  const [cfErrors, setCfErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>({
    typ: "Privatperson",
    anrede: "Frau",
    titel: "",
    vorname: "",
    nachname: "",
    firma: "",
    geburtsdatum: "",
    email: "",
    telefon: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    land: "DE",
    iban: "",
    bic: "",
    kontoinhaber: "",
    anteile: 1,
    newsletter: true,
    satzungAkzeptiert: false,
    custom: {},
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("Konfiguration nicht geladen");
      const cf = state.custom;
      const member = await submitAnmeldung({
        typ: state.typ,
        anrede: state.anrede,
        titel: ((cf.titel as string) || state.titel) || undefined,
        vorname: state.vorname.trim(),
        nachname: state.nachname.trim(),
        firma: ((cf.firma as string) || state.firma) || undefined,
        geburtsdatum: ((cf.geburtsdatum as string) || state.geburtsdatum) || undefined,
        email: state.email.trim(),
        telefon: ((cf.telefon as string) || state.telefon) || undefined,
        strasse: state.strasse,
        hausnummer: state.hausnummer,
        plz: state.plz,
        ort: state.ort,
        land: state.land,
        iban: state.iban.replace(/\s+/g, ""),
        bic: state.bic,
        kontoinhaber: state.kontoinhaber || `${state.vorname} ${state.nachname}`,
        newsletter: cf.newsletter !== undefined ? !!cf.newsletter : state.newsletter,
        customFields: state.custom,
        anteile: state.anteile,
      });
      qc.invalidateQueries();
      return member;
    },
    onSuccess: (m) => setDone({ name: `${m.vorname} ${m.nachname}`, nummer: m.mitgliedsnummer }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">✓</div>
          <h2 className="text-2xl font-bold">Vielen Dank, {done.name}!</h2>
          <p className="text-muted-foreground">
            Dein Beitrittsantrag wurde aufgenommen. Mitgliedsnummer: <strong>{done.nummer}</strong>.
            Du erhältst eine Bestätigung sobald drei Vorstandsmitglieder zugestimmt haben und dein Anteilsbeitrag eingegangen ist.
          </p>
        </CardContent>
      </Card>
    );
  }

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!state.vorname || !state.nachname) return "Vor- und Nachname sind Pflicht";
      if (!z.string().email().safeParse(state.email).success) return "Bitte gültige E-Mail-Adresse angeben";
      const errs = validateCustomFields(state.custom, (cfQ.data ?? []).filter((f) => f.showOnSignup && ["titel","firma","geburtsdatum","telefon","bevorzugteAnrede"].includes(f.key)));
      setCfErrors((e) => ({ ...e, ...errs }));
      const first = Object.values(errs)[0];
      if (first) return first;
    }
    if (s === 1) {
      if (!state.strasse || !state.hausnummer || !state.plz || !state.ort) return "Bitte vollständige Adresse angeben";
    }
    if (s === 2) {
      if (!isValidIban(state.iban)) return "Ungültige IBAN";
    }
    if (s === 3) {
      if (!settings) return "Konfiguration lädt noch";
      if (state.anteile < settings.minAnteile) return `Mindestens ${settings.minAnteile} Anteile`;
      if (state.anteile > settings.maxAnteile) return `Höchstens ${settings.maxAnteile} Anteile`;
      const errs = validateCustomFields(state.custom, (cfQ.data ?? []).filter((f) => f.showOnSignup && !["titel","firma","geburtsdatum","telefon","bevorzugteAnrede","newsletter"].includes(f.key)));
      setCfErrors((e) => ({ ...e, ...errs }));
      const first = Object.values(errs)[0];
      if (first) return first;
    }
    if (s === 4) {
      if (!state.satzungAkzeptiert) return "Bitte Satzung bestätigen";
      const newsletterDef = (cfQ.data ?? []).find((f) => f.key === "newsletter");
      if (newsletterDef?.required && !(state.custom.newsletter ?? state.newsletter)) {
        setCfErrors((e) => ({ ...e, newsletter: "Newsletter ist erforderlich" }));
        return "Newsletter ist erforderlich";
      }
    }
    return null;
  };

  const validateAll = (): string | null => {
    for (let i = 0; i < stepLabels.length; i++) {
      const e = validateStep(i);
      if (e) return e;
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, stepLabels.length - 1));
  };
  const submit = () => {
    const err = layout === "single" ? validateAll() : validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    submitMut.mutate();
  };

  const totalCost = (settings?.anteilsWert ?? 0) * state.anteile;

  return (
    <Card>
      <CardContent className={compact ? "p-4" : "p-6"}>
        {layout === "stepper" && (
          <div className="mb-6 flex flex-wrap gap-2">
            {stepLabels.map((l, i) => (
              <div
                key={l}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}. {l}
              </div>
            ))}
          </div>
        )}

        {(layout === "single" || step === 0) && (
          <Section title="Persönlich" hide={layout !== "single"}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Kontakttyp">
              <Select value={state.typ} onValueChange={(v) => set("typ", v as Kontakttyp)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Privatperson">Privatperson</SelectItem>
                  <SelectItem value="Unternehmen">Unternehmen</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Anrede">
              <Select value={state.anrede} onValueChange={(v) => set("anrede", v as Anrede)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Frau">Frau</SelectItem>
                  <SelectItem value="Herr">Herr</SelectItem>
                  <SelectItem value="Divers">Divers</SelectItem>
                  <SelectItem value="Keine">Keine</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Vorname *"><Input value={state.vorname} onChange={(e) => set("vorname", e.target.value)} /></Field>
            <Field label="Nachname *"><Input value={state.nachname} onChange={(e) => set("nachname", e.target.value)} /></Field>
            <Field label="E-Mail *"><Input type="email" value={state.email} onChange={(e) => set("email", e.target.value)} /></Field>
          </div>
          {(cfQ.data ?? [])
            .filter((f) => f.showOnSignup && f.type !== "checkbox" && ["titel","firma","geburtsdatum","telefon","bevorzugteAnrede"].includes(f.key))
            .map((f) => renderCustomField(f, state.custom, set, cfErrors))}
          </Section>
        )}

        {(layout === "single" || step === 1) && (
          <Section title="Adresse" hide={layout !== "single"}>
          <div className="grid gap-4 md:grid-cols-3">
            <Field className="md:col-span-2" label="Straße *"><Input value={state.strasse} onChange={(e) => set("strasse", e.target.value)} /></Field>
            <Field label="Hausnr. *"><Input value={state.hausnummer} onChange={(e) => set("hausnummer", e.target.value)} /></Field>
            <Field label="PLZ *"><Input value={state.plz} onChange={(e) => set("plz", e.target.value)} /></Field>
            <Field className="md:col-span-2" label="Ort *"><Input value={state.ort} onChange={(e) => set("ort", e.target.value)} /></Field>
            <Field label="Land">
              <Select value={state.land} onValueChange={(v) => set("land", v as Land)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(settings?.laenderReihenfolge ?? ["DE", "AT", "CH"]).map((l) => (
                    <SelectItem key={l} value={l}>{LAND_LABELS[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          </Section>
        )}

        {(layout === "single" || step === 2) && (
          <Section title="Bankverbindung" hide={layout !== "single"}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field className="md:col-span-2" label="Kontoinhaber"><Input value={state.kontoinhaber} onChange={(e) => set("kontoinhaber", e.target.value)} placeholder={`${state.vorname} ${state.nachname}`.trim()} /></Field>
            <Field className="md:col-span-2" label="IBAN *"><Input value={state.iban} onChange={(e) => set("iban", e.target.value.toUpperCase())} placeholder="DE89 3704 0044 0532 0130 00" /></Field>
            <Field label="BIC"><Input value={state.bic} onChange={(e) => set("bic", e.target.value.toUpperCase())} /></Field>
            <p className="text-xs text-muted-foreground md:col-span-2">
              Mit Angabe der IBAN erteilst du der Genossenschaft ein SEPA-Lastschriftmandat für den Anteilsbeitrag.
            </p>
          </div>
          </Section>
        )}

        {(layout === "single" || step === 3) && (
          <Section title="Anteile" hide={layout !== "single"}>
          <div className="space-y-4">
            <Field label={`Anzahl Anteile (${settings?.minAnteile} – ${settings?.maxAnteile})`}>
              <Input type="number" min={settings?.minAnteile} max={settings?.maxAnteile} value={state.anteile} onChange={(e) => set("anteile", Number(e.target.value))} />
            </Field>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm">Anteilswert pro Stück: <strong>{formatEuro(settings?.anteilsWert ?? 0)}</strong></p>
              <p className="mt-1 text-lg font-semibold">Gesamt: {formatEuro(totalCost)}</p>
            </div>
            {(cfQ.data ?? [])
              .filter((f) => f.showOnSignup && !["titel","firma","geburtsdatum","telefon","bevorzugteAnrede","newsletter"].includes(f.key))
              .map((f) => renderCustomField(f, state.custom, set, cfErrors))}
          </div>
          </Section>
        )}

        {(layout === "single" || step === 4) && (
          <Section title="Bestätigung" hide={layout !== "single"}>
          <div className="space-y-4">
            {layout === "stepper" && (
              <>
                <p className="text-sm">Bitte prüfe deine Angaben:</p>
                <Textarea
                  readOnly
                  rows={8}
                  value={`${state.vorname} ${state.nachname}\n${state.strasse} ${state.hausnummer}\n${state.plz} ${state.ort}, ${LAND_LABELS[state.land]}\n${state.email}\nIBAN: ${state.iban}\n${state.anteile} Anteile à ${formatEuro(settings?.anteilsWert ?? 0)} = ${formatEuro(totalCost)}`}
                />
              </>
            )}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={state.satzungAkzeptiert} onCheckedChange={(c) => set("satzungAkzeptiert", !!c)} className="mt-0.5" />
              <span
                dangerouslySetInnerHTML={{
                  __html:
                    settings?.signup?.satzungText ??
                    'Ich habe die <a href="/dokumente/satzung" target="_blank" rel="noreferrer" class="underline">Satzung</a> gelesen und akzeptiere sie.',
                }}
              />
            </label>
            {(settings?.signup?.showNewsletter ?? true) && (cfQ.data ?? [])
              .filter((f) => f.key === "newsletter" && f.showOnSignup)
              .map((f) => (
                <label key={f.id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={state.custom.newsletter !== undefined ? !!state.custom.newsletter : state.newsletter}
                    onCheckedChange={(c) => set("custom", { ...state.custom, newsletter: !!c })}
                    className="mt-0.5"
                  />
                  <span>{f.label}{f.required && " *"}</span>
                </label>
              ))}
          </div>
          </Section>
        )}

        {layout === "stepper" ? (
        <div className="mt-8 flex justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Zurück
          </Button>
          {step < stepLabels.length - 1 ? (
            <Button onClick={next}>Weiter</Button>
          ) : (
            <Button onClick={submit} disabled={submitMut.isPending}>
              {submitMut.isPending ? "Sende…" : "Antrag absenden"}
            </Button>
          )}
        </div>
        ) : (
          <div className="mt-8 flex justify-end">
            <Button onClick={submit} disabled={submitMut.isPending} size="lg">
              {submitMut.isPending ? "Sende…" : "Antrag absenden"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Section({ title, hide, children }: { title: string; hide: boolean; children: React.ReactNode }) {
  if (hide) return <>{children}</>;
  return (
    <section className="mb-8 border-b pb-6 last:border-0 last:pb-0">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function renderCustomField(
  f: CustomFieldDef,
  values: Record<string, unknown>,
  set: (k: "custom", v: Record<string, unknown>) => void,
  errors: Record<string, string>,
) {
  const v = values[f.key];
  const onChange = (val: unknown) => set("custom", { ...values, [f.key]: val });
  const err = errors[f.key];
  return (
    <div key={f.id} className="space-y-1.5">
      <Label>{f.label}{f.required && " *"}</Label>
      {f.type === "text" && <Input value={(v as string) ?? ""} onChange={(e) => onChange(e.target.value)} />}
      {f.type === "number" && (
        <Input type="number" value={v === undefined ? "" : (v as number)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
      )}
      {f.type === "date" && <Input type="date" value={(v as string) ?? ""} onChange={(e) => onChange(e.target.value)} />}
      {f.type === "checkbox" && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={!!v} onCheckedChange={(c) => onChange(!!c)} />
          <span className="text-muted-foreground">{f.label}</span>
        </label>
      )}
      {f.type === "select" && (
        <Select value={(v as string) ?? ""} onValueChange={(val) => onChange(val)}>
          <SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
          <SelectContent>
            {(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}