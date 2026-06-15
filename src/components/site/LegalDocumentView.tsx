import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { formatLegalDate, type LegalDocument } from "@/lib/legal";

export function LegalDocumentView({ slug, fallbackTitle }: { slug: string; fallbackTitle: string }) {
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data } = await supabase
        .from("legal_documents")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (mounted) {
        setDoc(data as LegalDocument | null);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-surface">
        <article className="mx-auto max-w-3xl px-4 py-16 md:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Documento legal</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
            {doc?.title ?? fallbackTitle}
          </h1>
          {doc && (
            <p className="mt-3 text-sm text-gray-500">
              Última atualização: {formatLegalDate(doc.updated_at)}
            </p>
          )}

          {loading ? (
            <div className="mt-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : doc ? (
            <div
              className="legal-content prose prose-neutral mt-8 max-w-none text-foreground/90"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(doc.content) }}
            />
          ) : (
            <p className="mt-8 text-muted-foreground">Documento não encontrado.</p>
          )}

          <div className="mt-10">
            <Link to="/" className="text-sm font-semibold text-primary hover:underline">
              ← Voltar para a página inicial
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
