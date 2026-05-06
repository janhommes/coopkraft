import type { NewsletterBranding } from "./types";
import type { Settings } from "./types";

export const defaultNewsletterBranding: Required<NewsletterBranding> = {
  headerHtml: "",
  footerHtml: "",
  background: "#eeeeee",
  contentBackground: "#ffffff",
  textColor: "#1a1a1a",
  accentColor: "#2e7d32",
};

export function mergeNewsletterBranding(b?: NewsletterBranding): Required<NewsletterBranding> {
  return { ...defaultNewsletterBranding, ...(b ?? {}) };
}

/**
 * Renders a complete HTML email document (table-based) using the branding
 * header/footer and the campaign body HTML.
 */
export function renderNewsletterHtml(opts: {
  subject: string;
  bodyHtml: string;
  branding?: NewsletterBranding;
}): string {
  const b = mergeNewsletterBranding(opts.branding);
  const safeSubject = escapeHtml(opts.subject || "");
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:${b.background};color:${b.textColor};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${b.background};padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${b.contentBackground};border-radius:6px;overflow:hidden;">
      <tr><td>${b.headerHtml ?? ""}</td></tr>
      <tr><td style="padding:24px;color:${b.textColor};font-size:15px;line-height:1.55;">
        ${opts.bodyHtml || ""}
      </td></tr>
      <tr><td>${b.footerHtml ?? ""}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/**
 * Builds a header HTML block from the global Settings (logo + name + accent color).
 */
export function buildBrandedHeader(settings: Pick<Settings, "genossenschaftsName" | "logoDataUrl" | "primary"> | undefined): string {
  const name = escapeHtml(settings?.genossenschaftsName ?? "");
  const bg = settings?.primary ?? "#2e7d32";
  const logo = settings?.logoDataUrl
    ? `<img src="${settings.logoDataUrl}" alt="${name}" style="max-height:60px;max-width:220px;display:block;margin:0 auto 8px;" />`
    : "";
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};color:#ffffff;padding:24px;text-align:center;font-family:Arial,sans-serif;"><tr><td>${logo}<h1 style="margin:0;font-size:22px;font-weight:600;color:#ffffff;">${name}</h1><p style="margin:6px 0 0;font-size:13px;opacity:0.9;">Newsletter</p></td></tr></table>`;
}

/**
 * Builds a footer HTML block from the global Settings (name + bank/legal lines + unsubscribe).
 */
export function buildBrandedFooter(settings: Pick<Settings, "genossenschaftsName" | "primary" | "bank"> | undefined): string {
  const name = escapeHtml(settings?.genossenschaftsName ?? "");
  const accent = settings?.primary ?? "#2e7d32";
  const inhaber = escapeHtml(settings?.bank?.kontoinhaber ?? name);
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f0;color:#555;padding:20px;text-align:center;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;"><tr><td><strong>${name}</strong><br/>${inhaber}<br/>Du erhältst diese Mail, weil du Mitglied bist oder den Newsletter abonniert hast.<br/><a href="{{unsubscribe_url}}" style="color:${accent};">Vom Newsletter abmelden</a></td></tr></table>`;
}