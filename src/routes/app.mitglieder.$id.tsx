import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  approveMembership,
  confirmPayment,
  deleteMember,
  getMember,
  saveMember,
  listApprovals,
  listPaymentConfirmations,
} from "@/services/members.service";
import {
  approveTermination,
  listTerminations,
  rejectTermination,
  requestTermination,
  cancelTermination,
} from "@/services/terminations.service";
import {
  approveTransfer,
  createLot,
  listLots,
  listTransfers,
  rejectTransfer,
  requestTransfer,
  activeShareCount,
} from "@/services/shares.service";
import { listAudit } from "@/services/audit.service";
import { listDocuments, uploadDocument, deleteDocument, downloadDocument } from "@/services/documents.service";
import { dividendsByMember } from "@/services/dividends.service";
import { getSettings, getWorkflow } from "@/services/settings.service";
import { calcEffectiveDate } from "@/lib/termination";
import { useAuth } from "@/components/providers/AuthProvider";
import { can } from "@/lib/permissions";
import { formatDate, formatDateTime, formatEuro, memberStatusLabel, lotStatusLabel, transferStatusLabel, terminationStatusLabel } from "@/lib/locale";
import {
  ROLE_LABELS,
  BUNDESLAND_LABELS,
  KONFESSION_LABELS,
  type Bundesland,
  type DocCategory,
  type Konfession,
  type Member,
} from "@/lib/types";

export const Route = createFileRoute("/app/mitglieder/$id")({
  component: MemberDetailPage,
});

function MemberDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const memberQ = useQuery({ queryKey: ["member", id], queryFn: () => getMember(id) });
  const lotsQ = useQuery({ queryKey: ["lots"], queryFn: listLots });
  const apprQ = useQuery({ queryKey: ["approvals"], queryFn: listApprovals });
  const payQ = useQuery({ queryKey: ["payments"], queryFn: listPaymentConfirmations });
  const termQ = useQuery({ queryKey: ["terminations"], queryFn: listTerminations });
  const transQ = useQuery({ queryKey: ["transfers"], queryFn: listTransfers });
  const docsQ = useQuery({ queryKey: ["documents"], queryFn: listDocuments });
  const auditQ = useQuery({ queryKey: ["audit", id], queryFn: () => listAudit(id) });
  const divQ = useQuery({ queryKey: ["dividends", "member", id], queryFn: () => dividendsByMember(id) });
  const wfQ = useQuery({ queryKey: ["workflow"], queryFn: getWorkflow });
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const allMembersQ = useQuery({ queryKey: ["members"], queryFn: async () => (await import("@/services/members.service")).listMembers() });

  const m = memberQ.data;
  if (!m || !user) return <div className="p-6 text-muted-foreground">Lade…</div>;

  const myLots = (lotsQ.data ?? []).filter((l) => l.memberId === id);
  const myApprovals = (apprQ.data ?? []).filter((a) => a.memberId === id);
  const myPayments = (payQ.data ?? []).filter((p) => p.memberId === id);
  const myTerminations = (termQ.data ?? []).filter((t) => t.memberId === id);
  const allMembers = allMembersQ.data ?? [];

  const wf = wfQ.data;
  const confirms = myApprovals.filter((a) => a.role === "mitgliedsbestaetiger" && a.decision === "approve").length;
  const aufsicht = myApprovals.filter((a) => a.role === "aufsichtsrat" && a.decision === "approve").length;
  const paymentsOk = myPayments.length > 0;
  const reqConf = wf?.beitritt.anzahlBestaetigungen ?? 3;

  const isSelf = user.memberId === id;

  const onDelete = async () => {
    if (!user.roles.includes("admin")) return;
    const confirmed = window.confirm(
      `Mitglied "${m.vorname} ${m.nachname}" (Nr. ${m.mitgliedsnummer}) wirklich vollständig löschen?\n\nAlle Anteile, Approvals, Zahlungen, Kündigungen, Übertragungen und Dokumente werden mit gelöscht. Dies kann nicht rückgängig gemacht werden.`,
    );
    if (!confirmed) return;
    try {
      await deleteMember(m.id, user);
      qc.invalidateQueries();
      toast.success("Mitglied gelöscht");
      navigate({ to: "/app/mitglieder" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/app/mitglieder" className="text-sm text-muted-foreground hover:underline">← Mitglieder</Link>
          <h1 className="mt-1 text-2xl font-bold">{m.vorname} {m.nachname}</h1>
          <p className="text-sm text-muted-foreground">Mitgliedsnr. {m.mitgliedsnummer} · {m.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{memberStatusLabel(m.status)}</Badge>
          {can(user, "delete:member") && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Mitglied löschen
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="stamm">
        <TabsList>
          <TabsTrigger value="stamm">Stammdaten</TabsTrigger>
          <TabsTrigger value="anteile">Anteile ({myLots.length})</TabsTrigger>
          <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="kuendigung">Kündigung</TabsTrigger>
          <TabsTrigger value="dividenden">Dividenden ({divQ.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="stamm" className="mt-4">
          <StammForm member={m} canEdit={can(user, "edit:member") || isSelf} onSave={async (next) => { await saveMember(next); qc.invalidateQueries(); toast.success("Gespeichert"); }} />
        </TabsContent>

        <TabsContent value="anteile" className="mt-4 space-y-3">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Gezeichnet</th>
                    <th className="p-3">Anzahl</th>
                    <th className="p-3">Wert/Anteil</th>
                    <th className="p-3">Summe</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {myLots.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-3">{formatDate(l.signedAt)}</td>
                      <td className="p-3">{l.count}</td>
                      <td className="p-3">{formatEuro(l.valuePerShare)}</td>
                      <td className="p-3">{formatEuro(l.count * l.valuePerShare)}</td>
                      <td className="p-3"><Badge variant="outline">{lotStatusLabel(l.status)}</Badge></td>
                      <td className="p-3">
                        <LotActions
                          memberId={m.id}
                          lotId={l.id}
                          lotCount={l.count}
                          status={l.status}
                          allMembers={allMembers}
                          maxAnteile={settingsQ.data?.maxAnteile ?? 0}
                          onAction={() => qc.invalidateQueries()}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          {(can(user, "edit:member") || isSelf) && m.status === "active" && settingsQ.data && (
            <SubscribeSharesButton
              currentTotal={myLots.filter((l) => l.status === "active" || l.status === "pending_payment" || l.status === "terminating").reduce((s, l) => s + l.count, 0)}
              minAnteile={settingsQ.data.minAnteile}
              maxAnteile={settingsQ.data.maxAnteile}
              valuePerShare={settingsQ.data.anteilsWert}
              onSubscribe={async (count) => {
                await createLot(m.id, count, settingsQ.data!.anteilsWert, user, false);
                qc.invalidateQueries();
                toast.success(`${count} Anteil${count === 1 ? "" : "e"} gezeichnet (Zahlungseingang ausstehend)`);
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="dokumente" className="mt-4">
          <DocumentsTab
            memberId={m.id}
            docs={(docsQ.data ?? []).filter((d) => d.memberId === m.id && (can(user, "upload:document:member") || (isSelf && d.visibleToMember)))}
            canManage={can(user, "upload:document:member")}
            isSelf={isSelf}
            onChange={() => qc.invalidateQueries()}
          />
        </TabsContent>

        <TabsContent value="approvals" className="mt-4 space-y-3">
          <Card>
            <CardHeader><CardTitle>Beitritts-Workflow</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label={`Mitgliedsbestätigungen (${confirms} / ${reqConf})`} ok={confirms >= reqConf} />
              {wf?.beitritt.aufsichtsratPflicht && <Row label={`Aufsichtsrat (${aufsicht} / ${wf.beitritt.aufsichtsratAnzahl})`} ok={aufsicht >= wf.beitritt.aufsichtsratAnzahl} />}
              {wf?.beitritt.zahlungPflicht && <Row label="Zahlungseingang" ok={paymentsOk} />}
            </CardContent>
          </Card>

          {m.status === "pending" && can(user, "approve:membership") && (
            <Card>
              <CardHeader><CardTitle>Bestätigen</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {user.roles.includes("mitgliedsbestaetiger") && (
                  <Button onClick={async () => { try { await approveMembership(m.id, user, "mitgliedsbestaetiger", "approve"); qc.invalidateQueries(); toast.success("Bestätigt"); } catch (e) { toast.error((e as Error).message); } }}>
                    Als Mitgliedsbestätiger zustimmen
                  </Button>
                )}
                {user.roles.includes("aufsichtsrat") && (
                  <Button variant="secondary" onClick={async () => { try { await approveMembership(m.id, user, "aufsichtsrat", "approve"); qc.invalidateQueries(); toast.success("Bestätigt"); } catch (e) { toast.error((e as Error).message); } }}>
                    Als Aufsichtsrat zustimmen
                  </Button>
                )}
                <Button variant="destructive" onClick={async () => { try { await approveMembership(m.id, user, "mitgliedsbestaetiger", "reject", "Ablehnung"); qc.invalidateQueries(); toast.success("Abgelehnt"); } catch (e) { toast.error((e as Error).message); } }}>
                  Ablehnen
                </Button>
              </CardContent>
            </Card>
          )}

          {can(user, "confirm:payment") && (
            <Card>
              <CardHeader><CardTitle>Zahlungseingang bestätigen</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {myLots.filter((l) => l.status === "pending_payment").map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded border p-2">
                    <span className="text-sm">{l.count} Anteile à {formatEuro(l.valuePerShare)} = {formatEuro(l.count * l.valuePerShare)}</span>
                    <Button size="sm" onClick={async () => { await confirmPayment(m.id, l.id, l.count * l.valuePerShare, user); qc.invalidateQueries(); toast.success("Zahlung bestätigt"); }}>
                      Eingegangen
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Verlauf</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {myApprovals.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>{a.userName} ({ROLE_LABELS[a.role]}) – {a.decision === "approve" ? "✓" : "✗"}</span>
                  <span className="text-muted-foreground">{formatDateTime(a.at)}</span>
                </div>
              ))}
              {myApprovals.length === 0 && <p className="text-muted-foreground">Noch keine Bestätigungen</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Anteilsübertragungen</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(transQ.data ?? []).filter((t) => t.fromMemberId === m.id || t.toMemberId === m.id).map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span>
                    {t.kind === "sale" ? "Verkauf" : "Spende"}: {t.count} Anteile {t.fromMemberId === m.id ? "→" : "←"} ({transferStatusLabel(t.status)})
                  </span>
                  {t.status === "pending" && can(user, "manage:transfers") && (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={async () => { await approveTransfer(t.id, user); qc.invalidateQueries(); toast.success("Übertragung bestätigt"); }}>Bestätigen</Button>
                      <Button size="sm" variant="ghost" onClick={async () => { await rejectTransfer(t.id, user); qc.invalidateQueries(); }}>Ablehnen</Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kuendigung" className="mt-4 space-y-3">
          {myTerminations.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Kündigungen</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[...myTerminations]
                  .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
                  .map((t) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const isActive = t.status === "pending" || t.status === "approved";
                    const canCancel =
                      isActive &&
                      t.effectiveDate > today &&
                      (can(user, "edit:member") || (isSelf && t.status === "pending"));
                    const lot = t.lotId ? (lotsQ.data ?? []).find((l) => l.id === t.lotId) : undefined;
                    return (
                      <div key={t.id} className="rounded border p-3 text-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="font-medium">
                              {t.target === "membership"
                                ? "Kündigung der Mitgliedschaft"
                                : `Kündigung von ${t.shareCount ?? lot?.count ?? "?"} Anteil(en)`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Eingereicht am {formatDateTime(t.requestedAt)}
                            </div>
                          </div>
                          <Badge variant={
                            t.status === "approved" ? "default"
                            : t.status === "pending" ? "secondary"
                            : "outline"
                          }>
                            {terminationStatusLabel(t.status)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-muted-foreground">Wirksam zum</div>
                            <div className="font-medium">{formatDate(t.effectiveDate)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Auszahlung</div>
                            <div className="font-medium">{formatDate(t.payoutDate)}</div>
                          </div>
                          {lot && (
                            <div className="col-span-2">
                              <div className="text-muted-foreground">Betroffenes Lot</div>
                              <div className="font-medium">
                                Lot {lot.id.slice(0, 6)} · {lot.count} Anteile · gez. {formatDate(lot.signedAt)}
                              </div>
                            </div>
                          )}
                          {t.reason && (
                            <div className="col-span-2">
                              <div className="text-muted-foreground">Begründung</div>
                              <div className="whitespace-pre-wrap">{t.reason}</div>
                            </div>
                          )}
                        </div>

                        {t.approvals.length > 0 && (
                          <div className="text-xs">
                            <div className="text-muted-foreground mb-1">Bestätigungen</div>
                            <ul className="space-y-0.5">
                              {t.approvals.map((a, i) => (
                                <li key={i}>
                                  · {a.userName} <span className="text-muted-foreground">({ROLE_LABELS[a.role] ?? a.role})</span> – {formatDateTime(a.at)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(t.status === "pending" || canCancel) && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {t.status === "pending" && can(user, "approve:termination") && (
                              <>
                                <Button size="sm" onClick={async () => { try { await approveTermination(t.id, user); qc.invalidateQueries(); toast.success("Bestätigt"); } catch (e) { toast.error((e as Error).message); } }}>Bestätigen</Button>
                                <Button size="sm" variant="ghost" onClick={async () => { await rejectTermination(t.id, user); qc.invalidateQueries(); toast.success("Abgelehnt"); }}>Ablehnen</Button>
                              </>
                            )}
                            {canCancel && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  if (!window.confirm("Kündigung wirklich zurückziehen? Status wird auf aktiv zurückgesetzt.")) return;
                                  try {
                                    await cancelTermination(t.id, user);
                                    qc.invalidateQueries();
                                    toast.success("Kündigung zurückgezogen");
                                  } catch (e) {
                                    toast.error((e as Error).message);
                                  }
                                }}
                              >
                                Kündigung abbrechen
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}
          {(isSelf || can(user, "edit:member")) && m.status === "active" && wf && (
            <KuendigungBox
              member={m}
              fristInfo={(() => {
                const earliest = calcEffectiveDate(wf.membership, m.beitrittDatum ?? m.createdAt);
                return earliest.toISOString().slice(0, 10);
              })()}
              onSubmit={async (wishDate, reason) => {
                await requestTermination("membership", m.id, user, { reason, wishDate });
                qc.invalidateQueries();
                toast.success("Kündigung eingereicht");
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="dividenden" className="mt-4">
          <Card>
            <CardContent className="p-4 text-sm">
              {(divQ.data ?? []).length === 0 ? (
                <p className="text-muted-foreground">Noch keine Dividenden ausgeschüttet.</p>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between border-b pb-2">
                    <span className="font-medium">Insgesamt erhalten (brutto / netto)</span>
                    <span className="font-semibold">
                      {formatEuro((divQ.data ?? []).reduce((s, d) => s + d.total, 0))}
                      {" / "}
                      {formatEuro((divQ.data ?? []).reduce((s, d) => s + d.items.reduce((a, i) => a + (i.net ?? i.amount), 0), 0))}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(divQ.data ?? []).map((d) => (
                      <div key={d.run.id} className="rounded border p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">GJ {d.run.fiscalYear} · {d.run.ratePercent}%</div>
                            <div className="text-xs text-muted-foreground">
                              Lauf vom {formatDate(d.run.createdAt)} · {d.items.length} Lot(s)
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatEuro(d.total)} brutto</div>
                            <div className="text-xs text-muted-foreground">
                              {formatEuro(d.items.reduce((s, i) => s + (i.net ?? i.amount), 0))} netto
                            </div>
                            {d.run.certificates?.[m.id] && (
                              <button
                                type="button"
                                className="mt-1 text-xs text-primary hover:underline"
                                onClick={async () => {
                                  const certId = d.run.certificates?.[m.id];
                                  if (!certId) return;
                                  const r = await downloadDocument(certId);
                                  if (r) window.open(r.url, "_blank");
                                }}
                              >
                                Steuerbescheinigung (PDF)
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                          {d.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>Lot {it.lotId.slice(0, 6)} · {it.days} Tage</span>
                              <span>
                                {formatEuro(it.amount)}
                                {it.net !== undefined && it.net !== it.amount && (
                                  <span className="ml-2 text-[11px]">(netto {formatEuro(it.net)})</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="space-y-1 p-4 text-sm">
              {(auditQ.data ?? []).map((a) => (
                <div key={a.id} className="flex justify-between border-b py-1.5 last:border-0">
                  <div>
                    <div className="font-medium">{a.action}</div>
                    {a.details && <div className="text-xs text-muted-foreground">{a.details}</div>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{a.userName}</div>
                    <div>{formatDateTime(a.at)}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border p-2">
      <span>{label}</span>
      <Badge variant={ok ? "default" : "secondary"}>{ok ? "✓" : "offen"}</Badge>
    </div>
  );
}

function StammForm({ member, canEdit, onSave }: { member: Member; canEdit: boolean; onSave: (m: Member) => void | Promise<void> }) {
  const [m, setM] = useState(member);
  return (
    <div className="space-y-4">
    <Card>
      <CardContent className="grid gap-4 p-6 md:grid-cols-2">
        {([
          ["vorname", "Vorname"],
          ["nachname", "Nachname"],
          ["email", "E-Mail"],
          ["telefon", "Telefon"],
          ["strasse", "Straße"],
          ["hausnummer", "Hausnummer"],
          ["plz", "PLZ"],
          ["ort", "Ort"],
          ["iban", "IBAN"],
          ["bic", "BIC"],
        ] as const).map(([k, l]) => (
          <div key={k} className="space-y-1.5">
            <Label>{l}</Label>
            <Input disabled={!canEdit} value={(m[k] as string) ?? ""} onChange={(e) => setM({ ...m, [k]: e.target.value })} />
          </div>
        ))}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Steuerliche Angaben</CardTitle>
        <p className="text-sm text-muted-foreground">
          Bestimmt den Steuerabzug bei der Dividendenausschüttung (Kapitalertragsteuer 25 %, Solidaritätszuschlag 5,5 %, ggf. Kirchensteuer 8/9 %).
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 p-6 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center gap-2">
          <input
            id="freistellung"
            type="checkbox"
            disabled={!canEdit}
            checked={!!m.freistellung}
            onChange={(e) => setM({ ...m, freistellung: e.target.checked })}
          />
          <Label htmlFor="freistellung" className="font-normal">
            Freistellungsauftrag liegt vor – kein Steuerabzug
          </Label>
        </div>
        <div className="space-y-1.5">
          <Label>Konfession</Label>
          <Select
            disabled={!canEdit || !!m.freistellung}
            value={m.konfession ?? "keine"}
            onValueChange={(v) => setM({ ...m, konfession: v as Konfession })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(KONFESSION_LABELS) as Konfession[]).map((k) => (
                <SelectItem key={k} value={k}>{KONFESSION_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Bundesland (für Kirchensteuer)</Label>
          <Select
            disabled={!canEdit || !!m.freistellung}
            value={m.bundesland ?? ""}
            onValueChange={(v) => setM({ ...m, bundesland: v as Bundesland })}
          >
            <SelectTrigger><SelectValue placeholder="– bitte wählen –" /></SelectTrigger>
            <SelectContent>
              {(Object.keys(BUNDESLAND_LABELS) as Bundesland[]).map((b) => (
                <SelectItem key={b} value={b}>{BUNDESLAND_LABELS[b]} ({b === "BY" || b === "BW" ? "8 %" : "9 %"})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label>Steuer-Identifikationsnummer (optional)</Label>
          <Input
            disabled={!canEdit}
            value={m.steuerId ?? ""}
            onChange={(e) => setM({ ...m, steuerId: e.target.value })}
            placeholder="11 Ziffern"
          />
        </div>
      </CardContent>
    </Card>

    {canEdit && (
      <div>
        <Button onClick={() => onSave({ ...m, updatedAt: new Date().toISOString() })}>Speichern</Button>
      </div>
    )}
    </div>
  );
}

function LotActions({ memberId, lotId, lotCount, status, allMembers, maxAnteile, onAction }: {
  memberId: string; lotId: string; lotCount: number; status: string;
  allMembers: Member[]; maxAnteile: number; onAction: () => void;
}) {
  const { user } = useAuth();
  const wfQ = useQuery({ queryKey: ["workflow"], queryFn: getWorkflow });
  const [open, setOpen] = useState<null | "transfer" | "terminate">(null);
  const [toMember, setToMember] = useState("");
  const [count, setCount] = useState(lotCount);
  const [price, setPrice] = useState(0);
  const [asDonation, setAsDonation] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  if (!user || status !== "active") return null;

  const verkaufErlaubt = wfQ.data?.transfer.verkaufErlaubt ?? false;
  const spendeErlaubt = wfQ.data?.transfer.spendeErlaubt ?? false;
  const transferErlaubt = verkaufErlaubt || spendeErlaubt;

  const onPickRecipient = async (id: string) => {
    setToMember(id);
    if (!id) { setRecipientCount(null); return; }
    try {
      const c = await activeShareCount(id);
      setRecipientCount(c);
    } catch {
      setRecipientCount(null);
    }
  };

  const recipientRemaining = recipientCount === null ? null : Math.max(0, maxAnteile - recipientCount);
  const exceedsRecipientMax = recipientRemaining !== null && count > recipientRemaining;

  const submit = async () => {
    try {
      if (open === "transfer") {
        if (!toMember) { toast.error("Empfänger wählen"); return; }
        const recCount = await activeShareCount(toMember);
        if (recCount + count > maxAnteile) {
          toast.error(`Empfänger würde Maximum von ${maxAnteile} Anteilen überschreiten (${recCount} + ${count})`);
          return;
        }
        const kind = asDonation ? "donation" : "sale";
        if (kind === "sale" && !verkaufErlaubt) { toast.error("Verkauf nicht erlaubt"); return; }
        if (kind === "donation" && !spendeErlaubt) { toast.error("Spende nicht erlaubt"); return; }
        await requestTransfer({
          kind,
          fromMemberId: memberId,
          fromLotId: lotId,
          toMemberId: toMember,
          count,
          pricePerShare: asDonation ? 0 : price,
          requestedBy: user.id,
        }, user);
        toast.success("Übertragung beantragt");
      } else if (open === "terminate") {
        await requestTermination("share", memberId, user, { lotId, shareCount: count });
        toast.success("Anteile gekündigt");
      }
      setOpen(null);
      setToMember("");
      setRecipientCount(null);
      setAsDonation(false);
      onAction();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" onClick={() => { setOpen("terminate"); setCount(lotCount); }}>Kündigen</Button>
      {transferErlaubt && (
        <Button size="sm" variant="ghost" onClick={() => {
          setOpen("transfer"); setCount(lotCount); setToMember(""); setRecipientCount(null);
          setAsDonation(!verkaufErlaubt && spendeErlaubt);
        }}>Übertragen</Button>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>
            {open === "transfer" ? "Anteile übertragen" : "Anteile kündigen"}
          </DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Anzahl</Label><Input type="number" min={1} max={lotCount} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
            {open === "transfer" && (
              <>
                <div>
                  <Label>Empfänger</Label>
                  <Select value={toMember} onValueChange={onPickRecipient}>
                    <SelectTrigger><SelectValue placeholder="Mitglied wählen" /></SelectTrigger>
                    <SelectContent>
                      {allMembers.filter((x) => x.id !== memberId && x.status === "active").map((x) => (
                        <SelectItem key={x.id} value={x.id}>{x.vorname} {x.nachname}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {recipientCount !== null && (
                    <p className={`mt-1 text-xs ${exceedsRecipientMax ? "text-destructive" : "text-muted-foreground"}`}>
                      Empfänger hat aktuell <strong>{recipientCount}</strong> Anteile · Maximum: <strong>{maxAnteile}</strong> · Noch möglich: <strong>{recipientRemaining}</strong>
                      {exceedsRecipientMax && ` — Übertragung würde Maximum überschreiten.`}
                    </p>
                  )}
                </div>
                {verkaufErlaubt && spendeErlaubt && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={asDonation} onChange={(e) => setAsDonation(e.target.checked)} />
                    Als Spende übertragen (kein Kaufpreis)
                  </label>
                )}
                {!asDonation && verkaufErlaubt && (
                  <div><Label>Preis pro Anteil</Label><Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>Abbrechen</Button>
            <Button onClick={submit} disabled={open === "transfer" && (exceedsRecipientMax || !toMember || count < 1)}>Bestätigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KuendigungBox({ member: _member, fristInfo, onSubmit }: { member: Member; fristInfo: string; onSubmit: (wishDate: string, reason: string) => Promise<void> }) {
  const [wish, setWish] = useState(fristInfo);
  const [reason, setReason] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle>Mitgliedschaft kündigen</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Frühestmöglicher Austrittstermin gemäß Satzung: <strong>{formatDate(fristInfo)}</strong></p>
        <div><Label>Wunsch-Austrittsdatum (kann später liegen)</Label><Input type="date" value={wish} onChange={(e) => setWish(e.target.value)} /></div>
        <div><Label>Begründung (optional)</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <Button variant="destructive" onClick={() => onSubmit(wish, reason)}>Kündigung einreichen</Button>
      </CardContent>
    </Card>
  );
}

function DocumentsTab({ memberId, docs, canManage, isSelf, onChange }: { memberId: string; docs: ReturnType<typeof Object>[]; canManage: boolean; isSelf: boolean; onChange: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocCategory>("Beitrittsantrag");
  const [visibleToMember, setVisibleToMember] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("Datei fehlt");
      await uploadDocument({ memberId, title, category, visibility: "internal", visibleToMember, description: undefined } as any, file, user);
    },
    onSuccess: () => { setOpen(false); setTitle(""); setFile(null); onChange(); toast.success("Hochgeladen"); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ Dokument hochladen</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Mitglieds-Dokument hochladen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>Kategorie</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as DocCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["Beitrittsantrag", "Ausweiskopie", "SEPA-Mandat", "Kündigung", "Sonstiges"] as DocCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Datei</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visibleToMember} onChange={(e) => setVisibleToMember(e.target.checked)} /> Auch für Mitglied sichtbar</label>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={() => upload.mutate()} disabled={!file || !title}>Hochladen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Titel</th>
                <th className="p-3">Kategorie</th>
                <th className="p-3">Hochgeladen</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d: any) => (
                <tr key={d.id} className="border-t">
                  <td className="p-3 font-medium">{d.title}</td>
                  <td className="p-3">{d.category}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(d.uploadedAt)}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={async () => {
                      const dl = await downloadDocument(d.id);
                      if (dl) { const a = document.createElement("a"); a.href = dl.url; a.download = d.fileName; a.click(); }
                    }}>Download</Button>
                    {canManage && <Button size="sm" variant="ghost" onClick={async () => { if (user) { await deleteDocument(d.id, user); onChange(); } }}>Löschen</Button>}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{isSelf ? "Keine für dich freigegebenen Dokumente." : "Noch keine Dokumente."}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function SubscribeSharesButton({
  currentTotal,
  minAnteile,
  maxAnteile,
  valuePerShare,
  onSubscribe,
}: {
  currentTotal: number;
  minAnteile: number;
  maxAnteile: number;
  valuePerShare: number;
  onSubscribe: (count: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const remaining = Math.max(0, maxAnteile - currentTotal);
  const [count, setCount] = useState(1);
  const tooMany = count > remaining;
  const tooFew = count < 1;
  const disabled = tooMany || tooFew || remaining === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setCount(Math.min(1, remaining) || 1); }}>
      <DialogTrigger asChild>
        <Button disabled={remaining === 0} title={remaining === 0 ? `Maximum von ${maxAnteile} Anteilen erreicht` : undefined}>
          + Weitere Anteile zeichnen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Weitere Anteile zeichnen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bestand: <strong>{currentTotal}</strong> · Maximum pro Mitglied: <strong>{maxAnteile}</strong> · Noch möglich: <strong>{remaining}</strong>
          </p>
          <div>
            <Label>Anzahl neu zu zeichnender Anteile</Label>
            <Input
              type="number"
              min={1}
              max={remaining}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 0)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Wert pro Anteil: {formatEuro(valuePerShare)} · Summe: <strong>{formatEuro((Number.isFinite(count) ? count : 0) * valuePerShare)}</strong>
            </p>
            {tooMany && <p className="mt-1 text-xs text-destructive">Maximum von {maxAnteile} Anteilen würde überschritten ({currentTotal} + {count} {">"} {maxAnteile}).</p>}
            {tooFew && <p className="mt-1 text-xs text-destructive">Mindestens 1 Anteil zeichnen.</p>}
            {minAnteile > 1 && currentTotal === 0 && <p className="mt-1 text-xs text-muted-foreground">Hinweis: Mindestbestand laut Satzung: {minAnteile}.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button
            disabled={disabled}
            onClick={async () => {
              if (currentTotal + count > maxAnteile) { toast.error(`Maximum von ${maxAnteile} Anteilen würde überschritten`); return; }
              await onSubscribe(count);
              setOpen(false);
            }}
          >Zeichnen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}