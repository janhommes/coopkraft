import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSettings, saveSettings } from "@/services/settings.service";
import type { GenossenschaftStammdaten, Land } from "@/lib/types";
import { LAND_LABELS } from "@/lib/locale";

export const Route = createFileRoute("/app/admin/stammdaten")({
  component: StammdatenAdmin,
});

const empty: GenossenschaftStammdaten = {
  name: "",
  strasse: "",
  hausnummer: "",
  plz: "",
  ort: "",
  land: "DE",
  steuernummer: "",
  ustIdNr: "",
  vertretenDurch: "",
  registergericht: "",
  registernummer: "",
};

function StammdatenAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [s, setS] = useState<GenossenschaftStammdaten>(empty);

  useEffect(() => {
    if (q.data) {
      setS({
        ...empty,
        name: q.data.genossenschaftsName,
        ...q.data.genossenschaft,
      });
    }
  }, [q.data]);

  const save = async () => {
    if (!q.data) return;
    await saveSettings({ ...q.data, genossenschaft: s });
    qc.invalidateQueries();
    toast.success("Gespeichert");
  };

  const set = (k: keyof GenossenschaftStammdaten) => (v: string) => setS({ ...s, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stammdaten der Genossenschaft</CardTitle>
        <p className="text-sm text-muted-foreground">
          Werden auf Steuerbescheinigungen, im Impressum und auf Schreiben verwendet.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 p-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label>Name</Label>
          <Input value={s.name ?? ""} onChange={(e) => set("name")(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Straße</Label>
          <Input value={s.strasse ?? ""} onChange={(e) => set("strasse")(e.target.value)} />
        </div>
        <div>
          <Label>Hausnummer</Label>
          <Input value={s.hausnummer ?? ""} onChange={(e) => set("hausnummer")(e.target.value)} />
        </div>
        <div>
          <Label>PLZ</Label>
          <Input value={s.plz ?? ""} onChange={(e) => set("plz")(e.target.value)} />
        </div>
        <div>
          <Label>Ort</Label>
          <Input value={s.ort ?? ""} onChange={(e) => set("ort")(e.target.value)} />
        </div>
        <div>
          <Label>Land</Label>
          <Select value={s.land ?? "DE"} onValueChange={(v) => setS({ ...s, land: v as Land })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["DE", "AT", "CH"] as Land[]).map((l) => (
                <SelectItem key={l} value={l}>{LAND_LABELS[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Steuernummer</Label>
          <Input value={s.steuernummer ?? ""} onChange={(e) => set("steuernummer")(e.target.value)} />
        </div>
        <div>
          <Label>USt-IdNr.</Label>
          <Input value={s.ustIdNr ?? ""} onChange={(e) => set("ustIdNr")(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Vertreten durch</Label>
          <Input
            value={s.vertretenDurch ?? ""}
            onChange={(e) => set("vertretenDurch")(e.target.value)}
            placeholder="z. B. Vorstand: Max Mustermann"
          />
        </div>
        <div>
          <Label>Registergericht</Label>
          <Input value={s.registergericht ?? ""} onChange={(e) => set("registergericht")(e.target.value)} />
        </div>
        <div>
          <Label>Registernummer</Label>
          <Input value={s.registernummer ?? ""} onChange={(e) => set("registernummer")(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Button onClick={save}>Speichern</Button>
        </div>
      </CardContent>
    </Card>
  );
}