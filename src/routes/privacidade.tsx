import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentView } from "@/components/site/LegalDocumentView";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Pratô" },
      { name: "description", content: "Política de Privacidade da plataforma Pratô." },
    ],
  }),
});

function PrivacidadePage() {
  return <LegalDocumentView slug="privacidade" fallbackTitle="Política de Privacidade" />;
}
