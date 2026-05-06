import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { downloadDocument, getPublicDocumentBySlug } from "@/services/documents.service";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/locale";

export const Route = createFileRoute("/dokumente/$slug")({
  component: PublicDocPage,
});

function PublicDocPage() {
  const { slug } = Route.useParams();
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof getPublicDocumentBySlug>>>(undefined);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await getPublicDocumentBySlug(slug);
      if (cancelled) return;
      setDoc(d);
      if (d) {
        const dl = await downloadDocument(d.id);
        if (!cancelled) setUrl(dl?.url ?? null);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (doc === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (!doc) {
    throw notFound();
  }
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background px-6 py-4">
        <Logo />
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">{doc.title}</h1>
        {doc.description && <p className="mt-2 text-muted-foreground">{doc.description}</p>}
        <p className="mt-4 text-sm text-muted-foreground">
          {doc.category} · Stand: {formatDate(doc.uploadedAt)} · {(doc.size / 1024).toFixed(0)} KB
        </p>
        {url && (
          <Button asChild className="mt-6">
            <a href={url} download={doc.fileName}>Datei herunterladen</a>
          </Button>
        )}
      </main>
    </div>
  );
}