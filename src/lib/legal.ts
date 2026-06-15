export type LegalDocument = {
  id: string;
  slug: string;
  title: string;
  content: string;
  updated_at: string;
  created_at: string;
};

export function formatLegalDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
