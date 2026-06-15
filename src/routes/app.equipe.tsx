import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, UserPlus, Pencil, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  countFutureDeliveriesForEmployee,
  deactivateEmployeeWithRefund,
} from "@/lib/employees.functions";

export const Route = createFileRoute("/app/equipe")({
  component: EquipePage,
  head: () => ({
    meta: [
      { title: "Minha Equipe — Pratô" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Employee = {
  id: string;
  company_id: string;
  name: string;
  identifier: string;
  department: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
};

type FormState = {
  name: string;
  identifier: string;
  department: string;
  is_active: boolean;
  is_admin: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  identifier: "",
  department: "",
  is_active: true,
  is_admin: false,
};

function EquipePage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string; identifier?: string }>({});
  const [saving, setSaving] = useState(false);

  const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(null);
  const [futureCount, setFutureCount] = useState<number>(0);
  const [deactivating, setDeactivating] = useState(false);

  const countFutureFn = useServerFn(countFutureDeliveriesForEmployee);
  const deactivateWithRefundFn = useServerFn(deactivateEmployeeWithRefund);

  const fetchEmployees = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("company_id", user.id)
      .order("name", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar funcionários.");
    } else {
      setEmployees((data ?? []) as Employee[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const sorted = useMemo(() => {
    if (!employees) return [];
    return [...employees].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [employees]);

  const isEmpty = !loading && (employees?.length ?? 0) === 0;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      name: emp.name,
      identifier: emp.identifier,
      department: emp.department ?? "",
      is_active: emp.is_active,
      is_admin: emp.is_admin,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const openSelfAdd = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      name: profile?.full_name ?? "",
      is_admin: true,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Informe o nome completo.";
    if (!form.identifier.trim()) next.identifier = "Informe o CPF ou matrícula.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    const payload = {
      company_id: user.id,
      name: form.name.trim(),
      identifier: form.identifier.trim(),
      department: form.department.trim() || null,
      is_active: form.is_active,
      is_admin: form.is_admin,
    };

    const { error } = editing
      ? await supabase.from("employees").update(payload).eq("id", editing.id)
      : await supabase.from("employees").insert(payload);

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        setErrors({ identifier: "Este CPF ou matrícula já está cadastrado." });
      } else {
        toast.error("Erro ao salvar funcionário.");
      }
      return;
    }
    toast.success(editing ? "Funcionário atualizado." : "Funcionário adicionado.");
    setDialogOpen(false);
    void fetchEmployees();
  };

  const openDeactivate = async (emp: Employee) => {
    setConfirmDeactivate(emp);
    setFutureCount(0);
    const res = await countFutureFn({ data: { employee_id: emp.id } });
    if (res.ok) setFutureCount(res.count);
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return;
    setDeactivating(true);
    try {
      if (futureCount > 0) {
        const res = await deactivateWithRefundFn({
          data: { employee_id: confirmDeactivate.id },
        });
        if (!res.ok) {
          toast.error("Erro ao desativar funcionário.");
          return;
        }
        toast.success(
          res.refunded > 0
            ? `Funcionário desativado. ${res.refunded} crédito(s) estornado(s).`
            : "Funcionário desativado.",
        );
      } else {
        const { error } = await supabase
          .from("employees")
          .update({ is_active: false })
          .eq("id", confirmDeactivate.id);
        if (error) {
          toast.error("Erro ao desativar.");
          return;
        }
        toast.success("Funcionário desativado.");
      }
      void fetchEmployees();
    } finally {
      setDeactivating(false);
      setConfirmDeactivate(null);
      setFutureCount(0);
    }
  };

  const handleReactivate = async (emp: Employee) => {
    const { error } = await supabase
      .from("employees")
      .update({ is_active: true })
      .eq("id", emp.id);
    if (error) {
      toast.error("Erro ao reativar.");
    } else {
      toast.success("Funcionário reativado.");
      void fetchEmployees();
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Minha Equipe
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Cadastre os colaboradores que receberão marmitas.
          </p>
        </div>
        <Button
          onClick={openCreate}
          size="lg"
          className="rounded-full bg-primary px-6 text-primary-foreground shadow-soft hover:bg-primary/90"
        >
          <UserPlus className="mr-1.5 h-4 w-4" />
          Adicionar Funcionário
        </Button>
      </header>

      {/* Banner de primeiro acesso */}
      {isEmpty && !bannerDismissed && (
        <Card className="flex flex-col items-start justify-between gap-4 border-0 bg-primary-soft p-6 shadow-card md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-primary">
                Comece cadastrando sua equipe.
              </p>
              <p className="mt-1 text-sm text-primary/80">
                Você também pode se adicionar como funcionário para ter seu consumo registrado no relatório mensal.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={openSelfAdd}
              className="rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90"
            >
              Me adicionar como funcionário
            </Button>
            <Button
              variant="ghost"
              onClick={() => setBannerDismissed(true)}
              className="text-primary/70 hover:text-primary"
            >
              Depois
            </Button>
          </div>
        </Card>
      )}

      {/* Tabela */}
      <Card className="border border-border/60 bg-card p-0 shadow-card">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Nenhum funcionário cadastrado ainda.
            </p>
            <p className="text-sm text-muted-foreground">
              Adicione sua equipe para começar a vincular agendamentos por pessoa.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/Matrícula</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((emp) => (
                <TableRow key={emp.id} className={emp.is_active ? "" : "opacity-60"}>
                  <TableCell className="font-medium text-foreground">
                    {emp.name}
                    {emp.is_admin && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Responsável
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{emp.identifier}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {emp.department || "—"}
                  </TableCell>
                  <TableCell>
                    {emp.is_active ? (
                      <Badge className="bg-brand-green text-white hover:bg-brand-green/90">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(emp)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      {emp.is_active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void openDeactivate(emp)}
                        >
                          <UserX className="mr-1 h-3.5 w-3.5" />
                          Desativar
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-brand-green hover:text-brand-green"
                          onClick={() => void handleReactivate(emp)}
                        >
                          <UserCheck className="mr-1 h-3.5 w-3.5" />
                          Reativar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Dialog adicionar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar funcionário" : "Adicionar funcionário"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize os dados do colaborador."
                : "Preencha os dados do novo colaborador."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Nome completo</Label>
              <Input
                id="emp-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: João da Silva"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-identifier">CPF ou Matrícula</Label>
              <Input
                id="emp-identifier"
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                placeholder="Ex: 123.456.789-00 ou MAT001"
              />
              {errors.identifier && (
                <p className="text-xs text-destructive">{errors.identifier}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-department">Setor / Departamento</Label>
              <Input
                id="emp-department"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Ex: Produção, Administrativo"
              />
            </div>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <div>
                  <Label htmlFor="emp-active" className="text-sm">
                    Status
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {form.is_active ? "Ativo" : "Inativo"}
                  </p>
                </div>
                <Switch
                  id="emp-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Salvando..." : "Salvar funcionário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert: confirmar desativação */}
      <AlertDialog
        open={!!confirmDeactivate}
        onOpenChange={(open) => !open && !deactivating && setConfirmDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              {futureCount > 0 ? (
                <>
                  <strong>{confirmDeactivate?.name}</strong> está incluído em{" "}
                  <strong>{futureCount}</strong> agendamento(s) futuro(s). Deseja
                  removê-lo desses agendamentos e estornar os créditos
                  correspondentes?
                </>
              ) : (
                <>
                  Deseja desativar <strong>{confirmDeactivate?.name}</strong>? Ele
                  não aparecerá nas próximas seleções de agendamento.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeactivate();
              }}
              disabled={deactivating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivating
                ? "Processando..."
                : futureCount > 0
                  ? "Desativar e estornar créditos"
                  : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
