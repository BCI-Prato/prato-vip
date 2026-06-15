import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, FileText } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import { formatLegalDate, type LegalDocument } from "@/lib/legal";

export const Route = createFileRoute("/admin/documentos")({
  component: AdminDocumentosPage,
});

function AdminDocumentosPage() {
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("legal_documents")
      .select("*")
      .order("slug");
    if (error) {
      toast.error("Erro ao carregar documentos");
    } else {
      setDocs(data as LegalDocument[]);
      setDrafts(Object.fromEntries((data as LegalDocument[]).map((d) => [d.slug, d.content])));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async (doc: LegalDocument) => {
    setSaving(doc.slug);
    const { error } = await supabase
      .from("legal_documents")
      .update({ content: drafts[doc.slug], updated_at: new Date().toISOString() })
      .eq("id", doc.id);
    setSaving(null);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Documento atualizado");
      void load();
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentos legais"
        subtitle="Edite os Termos de Serviço e a Política de Privacidade exibidos no site."
      />

      <Tabs defaultValue={docs[0]?.slug ?? "termos"} className="w-full">
        <TabsList>
          {docs.map((doc) => (
            <TabsTrigger key={doc.slug} value={doc.slug}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              {doc.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {docs.map((doc) => (
          <TabsContent key={doc.slug} value={doc.slug} className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{doc.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    Última atualização: {formatLegalDate(doc.updated_at)}
                  </p>
                </div>
                <Button
                  onClick={() => void handleSave(doc)}
                  disabled={saving === doc.slug || drafts[doc.slug] === doc.content}
                >
                  {saving === doc.slug ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar alterações
                </Button>
              </div>

              <Label htmlFor={`content-${doc.slug}`} className="text-sm font-medium">
                Conteúdo (HTML)
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Você pode usar tags HTML como &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;.
              </p>
              <Textarea
                id={`content-${doc.slug}`}
                value={drafts[doc.slug] ?? ""}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [doc.slug]: e.target.value }))}
                className="mt-2 min-h-[500px] font-mono text-xs"
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
