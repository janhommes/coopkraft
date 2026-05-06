import { useBranding } from "@/components/providers/BrandingProvider";

export function Logo({ className = "" }: { className?: string }) {
  const { settings } = useBranding();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {settings?.logoDataUrl ? (
        <img src={settings.logoDataUrl} alt="" className="h-8 w-8 rounded object-contain" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">
          {(settings?.genossenschaftsName ?? "G").slice(0, 1)}
        </div>
      )}
      <span className="font-semibold">{settings?.genossenschaftsName ?? "Genossenschaft"}</span>
    </div>
  );
}