export const formatEuro = (n: number): string =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

export const formatNumber = (n: number): string =>
  new Intl.NumberFormat("de-DE").format(n);

export const formatDate = (iso: string | undefined): string => {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const todayISO = (): string => new Date().toISOString();
export const todayDateISO = (): string => new Date().toISOString().slice(0, 10);

export const LAND_LABELS: Record<string, string> = {
  DE: "Deutschland",
  AT: "Österreich",
  CH: "Schweiz",
};