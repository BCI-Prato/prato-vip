import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, Lock, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  maskCNPJ,
  maskPhone,
  maskCEP,
  onlyDigits,
  isValidCNPJ,
  isValidPhone,
  isValidCEP,
  isValidEmail,
} from "@/lib/masks";

export const Route = createFileRoute("/app/configuracoes")({
  component: ConfigPage,
});

type ProfileForm = {
  company_name: string;
  full_name: string;
  phone: string; // digits only
  cnpj: string; // digits only
  finance_email: string;
  delivery_time: string;
  address_cep: string; // digits only
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_complement: string;
};

const EMPTY: ProfileForm = {
  company_name: "",
  full_name: "",
  phone: "",
  cnpj: "",
  finance_email: "",
  delivery_time: "",
  address_cep: "",
  address_street: "",
  address_number: "",
  address_neighborhood: "",
  address_complement: "",
};

function ConfigPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveryLocked, setDeliveryLocked] = useState(false);
  const [addressLocked, setAddressLocked] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY);

  // Password change
  const [pwd, setPwd] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "company_name, full_name, phone, cnpj, delivery_time, finance_email, address_cep, address_street, address_number, address_neighborhood, address_complement",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (cancel) return;
      const d = (data ?? {}) as Partial<ProfileForm> & { delivery_time?: string | null };
      const dt = d.delivery_time ?? "";
      const cep = onlyDigits(d.address_cep ?? "");
      setForm({
        company_name: d.company_name ?? "",
        full_name: d.full_name ?? "",
        phone: onlyDigits(d.phone ?? ""),
        cnpj: onlyDigits(d.cnpj ?? ""),
        finance_email: d.finance_email ?? "",
        delivery_time: dt ? dt.slice(0, 5) : "",
        address_cep: cep,
        address_street: d.address_street ?? "",
        address_number: d.address_number ?? "",
        address_neighborhood: d.address_neighborhood ?? "",
        address_complement: d.address_complement ?? "",
      });
      setDeliveryLocked(Boolean(dt));
      setAddressLocked(Boolean(cep));
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (form.cnpj && !isValidCNPJ(form.cnpj)) {
      toast.error("CNPJ inválido. Informe os 14 dígitos.");
      return;
    }
    if (form.phone && !isValidPhone(form.phone)) {
      toast.error("Telefone inválido.");
      return;
    }
    if (form.finance_email && !isValidEmail(form.finance_email)) {
      toast.error("E-mail do financeiro inválido.");
      return;
    }
    if (!addressLocked && form.address_cep && !isValidCEP(form.address_cep)) {
      toast.error("CEP inválido. Informe os 8 dígitos.");
      return;
    }

    setSaving(true);
    const payload: {
      company_name: string | null;
      full_name: string | null;
      phone: string | null;
      cnpj: string | null;
      finance_email: string | null;
      delivery_time?: string;
      address_cep?: string | null;
      address_street?: string | null;
      address_number?: string | null;
      address_neighborhood?: string | null;
      address_complement?: string | null;
    } = {
      company_name: form.company_name.trim() || null,
      full_name: form.full_name.trim() || null,
      phone: form.phone || null,
      cnpj: form.cnpj || null,
      finance_email: form.finance_email.trim() || null,
    };
    if (!deliveryLocked && form.delivery_time) {
      payload.delivery_time = form.delivery_time;
    }
    if (!addressLocked) {
      payload.address_cep = form.address_cep || null;
      payload.address_street = form.address_street.trim() || null;
      payload.address_number = form.address_number.trim() || null;
      payload.address_neighborhood = form.address_neighborhood.trim() || null;
      payload.address_complement = form.address_complement.trim() || null;
    }

    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    if (!deliveryLocked && form.delivery_time) setDeliveryLocked(true);
    if (!addressLocked && form.address_cep) setAddressLocked(true);
    toast.success("Dados atualizados com sucesso!");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error("A nova senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (pwd !== pwdConfirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setPwdSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    setPwd("");
    setPwdConfirm("");
    toast.success("Senha atualizada com sucesso!");
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atualize os dados da sua empresa, endereço de entrega e segurança.
        </p>
      </header>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1 — Dados da empresa */}
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold">Dados da empresa</h2>

          <div className="space-y-2">
            <Label htmlFor="company_name">Nome da empresa</Label>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Responsável</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login_email" className="flex items-center gap-2">
                E-mail de Acesso (Login)
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              </Label>
              <Input
                id="login_email"
                type="email"
                value={user?.email ?? ""}
                disabled
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                E-mail usado para entrar na plataforma. Para alterar, abra um chamado no Suporte.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={maskPhone(form.phone)}
                onChange={(e) => setForm({ ...form, phone: onlyDigits(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                value={maskCNPJ(form.cnpj)}
                onChange={(e) => setForm({ ...form, cnpj: onlyDigits(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="finance_email">E-mail do Financeiro</Label>
            <Input
              id="finance_email"
              type="email"
              placeholder="financeiro@empresa.com"
              value={form.finance_email}
              onChange={(e) => setForm({ ...form, finance_email: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Para envio de Notas Fiscais e cobranças.
            </p>
          </div>
        </Card>

        {/* Card 2 — Endereço e horário (logística) */}
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold">Endereço e horário de entrega</h2>

          <div className="space-y-4">
            <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
              <div className="space-y-2">
                <Label htmlFor="address_cep" className="flex items-center gap-2">
                  CEP
                  {addressLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </Label>
                <Input
                  id="address_cep"
                  inputMode="numeric"
                  placeholder="00000-000"
                  disabled={addressLocked}
                  value={maskCEP(form.address_cep)}
                  onChange={(e) =>
                    setForm({ ...form, address_cep: onlyDigits(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_street">Rua / Avenida</Label>
                <Input
                  id="address_street"
                  disabled={addressLocked}
                  value={form.address_street}
                  onChange={(e) => setForm({ ...form, address_street: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
              <div className="space-y-2">
                <Label htmlFor="address_number">Número</Label>
                <Input
                  id="address_number"
                  disabled={addressLocked}
                  value={form.address_number}
                  onChange={(e) => setForm({ ...form, address_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_neighborhood">Bairro</Label>
                <Input
                  id="address_neighborhood"
                  disabled={addressLocked}
                  value={form.address_neighborhood}
                  onChange={(e) =>
                    setForm({ ...form, address_neighborhood: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_complement">Complemento</Label>
              <Input
                id="address_complement"
                disabled={addressLocked}
                placeholder="Sala, andar, ponto de referência (opcional)"
                value={form.address_complement}
                onChange={(e) =>
                  setForm({ ...form, address_complement: e.target.value })
                }
              />
            </div>

            {addressLocked && (
              <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                Para alterar o endereço de entrega, por favor abra um chamado no
                Suporte para recalcularmos a rota.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-4">
            <Label htmlFor="delivery_time" className="flex items-center gap-2">
              Horário Preferencial de Entrega
              {deliveryLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </Label>
            <Input
              id="delivery_time"
              type="time"
              value={form.delivery_time}
              disabled={deliveryLocked}
              onChange={(e) => setForm({ ...form, delivery_time: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Obs: Sujeito a tolerância logística de 15 a 20 minutos. Para alterar
              o horário da sua rota, abra um chamado no Suporte.
            </p>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Salvar alterações
          </Button>
        </div>
      </form>

      {/* Card 3 — Segurança / Alterar senha */}
      <Card className="space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">Segurança</h2>
          <p className="text-xs text-muted-foreground">
            Atualize a senha de acesso à plataforma.
          </p>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new_password">Nova senha</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirmar nova senha</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                minLength={8}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" disabled={pwdSaving || !pwd}>
              {pwdSaving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-1.5 h-4 w-4" />
              )}
              Atualizar senha
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
