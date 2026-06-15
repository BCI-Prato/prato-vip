import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentView } from "@/components/site/LegalDocumentView";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
  head: () => ({
    meta: [
      { title: "Termos de Serviço — Pratô" },
      { name: "description", content: "Termos de serviço da plataforma Pratô para gestão de marmitas corporativas." },
    ],
  }),
});

function TermosPage() {
  return <LegalDocumentView slug="termos" fallbackTitle="Termos de Serviço" />;
}
