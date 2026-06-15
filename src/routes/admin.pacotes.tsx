import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, ArrowUp, ArrowDown, Trash2, Loader2, Eye, EyeOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBRL, formatNumberBR } from "@/lib/format";
import type { Package } from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/pacotes")({
  component: AdminPackagesPage,
});

const pkgSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(60),
  highlight_tag: z.string().trim().max(40).optional().or(z.literal("")),
  credits_amount: z.coerce.number().int().min(1, "Mínimo 1 refeição").max(100000),
  total_price: z.coerce.number().min(0).max(10000000),
  price_per_meal_text: z.string().trim().min(1, "Obrigatório").max(80),
  advantage_description: z.string().max(2000).optional().default(""),
  is_active: z.boolean(),
  display_order: z.coerce.number().int().min(0).max(10000),
  features: z.array(z.string().trim().min(1).max(200)).max(20),
});

type FormState = z.infer<typeof pkgSchema>;

const emptyForm: FormState = {
  name: "",
  highlight_tag: "",
  credits_amount: 50,
  total_price: 0,
  price_per_meal_text: "",
  advantage_description: "",
  is_active: true,
  display_order: 0,
  features: [],
};

function AdminPackagesPage() {
  const [items, setItems] = useState<Package[] | null>(null);
  const [editing, setEditing] = useState<Package | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Package | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("packages")
      .select("*")
      .order("display_order", { ascending: true });
    setItems((data ?? []) as Package[]);
  }

  async function toggleActive(pkg: Package) {
    const { error } = await supabase
      .from("packages")
      .update({ is_active: !pkg.is_active })
      .eq("id", pkg.id);
    if (error) {
      toast.error("Não foi possível atualizar o status");
      return;
    }
    toast.success(pkg.is_active ? "Pacote desativado" : "Pacote ativado");
    void load();
  }

  async function move(pkg: Package, dir: -1 | 1) {
    if (!items) return;
    const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
    const i = sorted.findIndex((x) => x.id === pkg.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i];
    const b = sorted[j];
    const { error } = await supabase.from("packages").upsert([
      { ...a, display_order: b.display_order },
      { ...b, display_order: a.display_order },
    ]);
    if (error) {
      toast.error("Não foi possível reordenar");
      return;
    }
    void load();
  }

  async function remove(pkg: Package) {
    const { error } = await supabase.from("packages").delete().eq("id", pkg.id);
    if (error) {
      toast.error("Não foi possível excluir");
      return;
    }
    toast.success("Pacote excluído");
    setDeleting(null);
    void load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pacotes"
        subtitle="Gerencie o que aparece na seção de pacotes da Landing Page."
        actions={
          <Button onClick={() => setCreating(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> Novo pacote
          </Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
        {items === null ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nenhum pacote cadastrado.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Ordem</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Refeições</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {items.map((p, idx) => (
                <tr key={p.id} className="align-middle">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-muted-foreground">{p.display_order}</span>
                      <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => void move(p, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={idx === items.length - 1} onClick={() => void move(p, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.highlight_tag && (
                      <Badge className="mt-1 bg-primary-soft text-primary">{p.highlight_tag}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatNumberBR(p.credits_amount)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{formatBRL(p.total_price)}</div>
                    <div className="text-xs text-muted-foreground">{p.price_per_meal_text}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void toggleActive(p)}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-secondary"
                    >
                      {p.is_active ? (
                        <><Eye className="h-3.5 w-3.5 text-brand-green" /> Ativo</>
                      ) : (
                        <><EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> Inativo</>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PackageDialog
        open={creating || !!editing}
        editing={editing}
        defaultOrder={items ? Math.max(0, ...items.map((i) => i.display_order)) + 1 : 1}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          void load();
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pacote?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o pacote <strong>{deleting?.name}</strong> permanentemente.
              Considere desativá-lo se quiser apenas escondê-lo da Landing Page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && void remove(deleting)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PackageDialog({
  open,
  editing,
  defaultOrder,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Package | null;
  defaultOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        highlight_tag: editing.highlight_tag ?? "",
        credits_amount: editing.credits_amount,
        total_price: Number(editing.total_price),
        price_per_meal_text: editing.price_per_meal_text,
        advantage_description: editing.advantage_description,
        is_active: editing.is_active,
        display_order: editing.display_order,
        features: (editing.features && editing.features.length > 0
          ? editing.features
          : editing.bonuses) ?? [],
      });
    } else {
      setForm({ ...emptyForm, display_order: defaultOrder });
    }
  }, [open, editing, defaultOrder]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = pkgSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos");
      return;
    }
    setSaving(true);
    const payload = {
      name: parsed.data.name,
      highlight_tag: parsed.data.highlight_tag ? parsed.data.highlight_tag : null,
      credits_amount: parsed.data.credits_amount,
      total_price: parsed.data.total_price,
      price_per_meal_text: parsed.data.price_per_meal_text,
      advantage_description: parsed.data.advantage_description,
      is_active: parsed.data.is_active,
      display_order: parsed.data.display_order,
      features: parsed.data.features,
      bonuses: parsed.data.features,
    };
    const { data, error } = editing
      ? await supabase.from("packages").update(payload).eq("id", editing.id).select()
      : await supabase.from("packages").insert(payload).select();
    setSaving(false);
    if (error) {
      console.error("[packages] save error", error);
      toast.error(`Não foi possível salvar: ${error.message}`);
      return;
    }
    if (editing && (!data || data.length === 0)) {
      toast.error("Sem permissão para atualizar. Faça login como admin (@pratoservicos.com).");
      return;
    }
    toast.success(editing ? "Pacote atualizado" : "Pacote criado");
    onSaved();
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar pacote" : "Novo pacote"}</DialogTitle>
          <DialogDescription>
            Os pacotes ativos aparecem na Landing Page na ordem definida abaixo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={60} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="highlight_tag">Tag de destaque</Label>
              <Input
                id="highlight_tag"
                value={form.highlight_tag ?? ""}
                onChange={(e) => set("highlight_tag", e.target.value)}
                placeholder="Ex.: Mais escolhido"
                maxLength={40}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="credits_amount">Refeições *</Label>
              <Input
                id="credits_amount"
                type="number"
                min={1}
                value={form.credits_amount}
                onChange={(e) => set("credits_amount", Number(e.target.value))}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="total_price">Preço total (R$) *</Label>
              <Input
                id="total_price"
                type="number"
                min={0}
                step="0.01"
                value={form.total_price}
                onChange={(e) => set("total_price", Number(e.target.value))}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="display_order">Ordem *</Label>
              <Input
                id="display_order"
                type="number"
                min={0}
                value={form.display_order}
                onChange={(e) => set("display_order", Number(e.target.value))}
                required
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="price_per_meal_text">Texto de preço por refeição *</Label>
            <Input
              id="price_per_meal_text"
              value={form.price_per_meal_text}
              onChange={(e) => set("price_per_meal_text", e.target.value)}
              placeholder="Ex.: R$ 24,00 por refeição"
              required
              maxLength={80}
              className="mt-1.5"
            />
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Tópicos / Bônus do pacote</Label>
                <p className="text-xs text-muted-foreground">
                  Aparecem como "checks" no card do pacote (Landing Page e Recompra).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => set("features", [...form.features, ""])}
                disabled={form.features.length >= 20}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar tópico
              </Button>
            </div>
            {form.features.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">Nenhum tópico adicionado.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {form.features.map((feat, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Input
                      value={feat}
                      onChange={(e) => {
                        const next = [...form.features];
                        next[idx] = e.target.value;
                        set("features", next);
                      }}
                      placeholder="Ex.: Entrega gratuita"
                      maxLength={200}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        set(
                          "features",
                          form.features.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
            <div>
              <Label htmlFor="is_active" className="font-semibold">Ativo na Landing Page</Label>
              <p className="text-xs text-muted-foreground">Quando desativado, o pacote some da página pública.</p>
            </div>
            <Switch
              id="is_active"
              checked={form.is_active}
              onCheckedChange={(v) => set("is_active", v)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Salvar alterações" : "Criar pacote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
