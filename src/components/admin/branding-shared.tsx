import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border bg-background"
          aria-label={label + " Farbwähler"}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#2e7d32" className="font-mono" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Hex-Format, z. B. #2e7d32</p>
    </div>
  );
}

// Best-effort: bestehende oklch-Werte aus älteren Settings als Hex anzeigen.
export function toHex(v: string): string {
  if (!v) return "#2e7d32";
  if (v.startsWith("#")) return v;
  if (typeof window !== "undefined") {
    try {
      const el = document.createElement("div");
      el.style.color = v;
      document.body.appendChild(el);
      const rgb = getComputedStyle(el).color;
      document.body.removeChild(el);
      const m = rgb.match(/\d+/g);
      if (m && m.length >= 3) {
        const [r, g, b] = m.map(Number);
        return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
      }
    } catch {}
  }
  return "#2e7d32";
}