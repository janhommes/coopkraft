import { useBranding } from "@/components/providers/BrandingProvider";

export function Logo({ className = "" }: { className?: string }) {
  const { settings } = useBranding();
  const name = settings?.genossenschaftsName ?? "Genossenschaft";
  if (settings?.logoDataUrl) {
    return (
      <div className={`flex w-full items-center justify-center ${className}`}>
        <img src={settings.logoDataUrl} alt={name} className="max-h-20 w-full object-contain" />
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">
        {name.slice(0, 1)}
      </div>
      <span className="font-semibold">{name}</span>
    </div>
  );
}