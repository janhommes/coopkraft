import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { AnmeldungForm } from "@/components/anmeldung/AnmeldungForm";

export const Route = createFileRoute("/embed/anmeldung")({
  component: EmbedPage,
});

function EmbedPage() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      try {
        window.parent.postMessage({ type: "egv:resize", height: h }, "*");
      } catch {
        /* noop */
      }
    });
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="bg-background p-4">
      <AnmeldungForm compact />
    </div>
  );
}