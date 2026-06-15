export type Package = {
  id: string;
  name: string;
  highlight_tag: string | null;
  credits_amount: number;
  total_price: number;
  price_per_meal_text: string;
  advantage_description: string;
  bonuses: string[];
  features: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type LeadStatus = "novo" | "em_contato" | "convertido" | "descartado";
export type LeadSource = "contact_form" | "checkout";

export type Lead = {
  id: string;
  package_id: string | null;
  full_name: string;
  company_name: string;
  email: string;
  phone: string;
  message: string | null;
  accepted_terms_at: string;
  status: LeadStatus;
  source: LeadSource;
  created_at: string;
  updated_at: string;
};
