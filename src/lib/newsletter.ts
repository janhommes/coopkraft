import type { NewsletterBranding } from "./types";

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