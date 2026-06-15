import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Search, UserPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export type EmployeeOption = {
  id: string;
  name: string;
  department: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  employees: EmployeeOption[];
  initialSelected: string[];
  onConfirm: (ids: string[]) => void;
};

export function EmployeeSelectionDialog({
  open,
  onOpenChange,
  title,
  employees,
  initialSelected,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [query, setQuery] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelected));
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...employees].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
    if (!q) return sorted;
    return sorted.filter((e) => e.name.toLowerCase().includes(q));
  }, [employees, query]);

  const count = selected.size;
  const belowMin = count > 0 && count < 3;
  const canConfirm = count === 0 || count >= 3;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Selecione os colaboradores para este dia.
          </DialogDescription>
        </DialogHeader>

        {employees.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserPlus className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Nenhum funcionário cadastrado.</p>
            <Link
              to="/app/equipe"
              className="text-sm font-semibold text-primary hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Cadastrar agora
            </Link>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar funcionário..."
                className="pl-9"
              />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border/60">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhum resultado.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {filtered.map((emp) => {
                    const checked = selected.has(emp.id);
                    return (
                      <li key={emp.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle(emp.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {emp.name}
                            </p>
                            {emp.department && (
                              <p className="truncate text-xs text-muted-foreground">
                                {emp.department}
                              </p>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{count}</span>{" "}
              funcionário{count === 1 ? "" : "s"} selecionado{count === 1 ? "" : "s"}{" "}
              ·{" "}
              <span className="font-semibold text-foreground">{count}</span>{" "}
              crédito{count === 1 ? "" : "s"} serão usados
            </div>

            {belowMin && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Pedido mínimo é de 3 marmitas por dia. Selecione pelo menos 3 funcionários ou deixe o dia sem agendamento.
                </span>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onConfirm(Array.from(selected));
              onOpenChange(false);
            }}
            disabled={!canConfirm || employees.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Confirmar seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
