
## Etapa 2 — Seleção de funcionários por dia nos Agendamentos

Manter intactos: sidebar, header, demais telas, identidade visual (laranja `#F15A25` / verde `#006837`, card salmão para saldo), navegação semanal, rodapé "Saldo atual · Esta confirmação · Saldo após", botão "Confirmar Agendamentos", bloqueio 24h, regras de mínimo de 3.

### 1. Banco — nova tabela `delivery_employees`

Migration criando:

- `id uuid PK default gen_random_uuid()`
- `scheduled_delivery_id uuid NOT NULL REFERENCES public.scheduled_deliveries(id) ON DELETE CASCADE`
- `employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE`
- `delivery_date date NOT NULL`
- `company_id uuid NOT NULL` (= `profiles.id` = `auth.uid()` da empresa logada, mesmo padrão usado em `employees`)
- `status text NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado','cancelado','entregue'))`
- `created_at timestamptz NOT NULL DEFAULT now()`
- Índices: `(company_id, delivery_date)`, `(employee_id, delivery_date, status)`, `(scheduled_delivery_id)`
- Unicidade: `UNIQUE (scheduled_delivery_id, employee_id)` para evitar duplicatas

GRANTs: `authenticated` (CRUD) e `service_role` (ALL). Sem `anon`.

RLS (`authenticated`):
- SELECT / INSERT / UPDATE / DELETE: `auth.uid() = company_id`
- ALL para admins via `has_role(auth.uid(),'admin')`

### 2. Tela `/app/agendamentos` — seleção por funcionário

Substituir apenas o bloco contador `+/-` de cada `DayCard` pelo novo fluxo. Tudo ao redor permanece.

Carregamento adicional ao montar a página:
- `employees` ativos da empresa (`is_active=true`, ordem alfabética) — uma vez
- `delivery_employees` da empresa para as semanas carregadas, agrupados por `delivery_date`

Estado local muda de `draft: Record<ymd, number>` para `draftEmployees: Record<ymd, string[]>` (ids selecionados). O `count` exibido e usado em todos os cálculos passa a ser `draftEmployees[ymd].length`. `scheduledByYmd` continua existindo (vem do total atual em `scheduled_deliveries`) para o cálculo de delta.

Estados do `DayCard`:
- **Vazio** (`length === 0` e editável): botão outline laranja centralizado "+ Selecionar funcionários" que abre o modal.
- **Preenchido**: número grande (estilo do contador atual) + lista dos 2 primeiros nomes + "e mais X" + ícone lápis abre o modal.
- **Bloqueado** (`!editable`): comportamento atual, exibe "Já agendado: X".

### 3. Modal `EmployeeSelectionDialog`

Componente novo em `src/components/app/EmployeeSelectionDialog.tsx` usando `Dialog` do shadcn (padrão já usado no app).

- Header: "Quem vai receber marmita em [dia da semana, DD/MM]?" + subtítulo.
- Busca em tempo real (filtra por nome, case-insensitive).
- Lista: checkbox + nome + setor (`text-xs text-muted-foreground`).
- Empty state: "Nenhum funcionário cadastrado." + link "Cadastrar agora" → `/app/equipe`.
- Footer: contador "X funcionário(s) selecionado(s) · X crédito(s) serão usados".
- Alerta inline se 1 ≤ selecionados < 3.
- Botões "Cancelar" e "Confirmar seleção" (laranja). Confirmar desabilitado se `selected.length ∈ {1,2}`.
- Salva apenas no estado local (`draftEmployees[ymd]`) — não persiste ainda.

### 4. Rodapé em tempo real

Sem alterações estruturais. O cálculo de `totalDebit/totalRefund/changedDays/invalidDays` passa a usar `draftEmployees[ymd].length` no lugar do número manual. Alerta "Pedido mínimo de 3 marmitas por dia não atingido em X dia(s)" continua, baseado na contagem por dia.

### 5. Confirmar Agendamentos

Estende `confirmScheduling` (server fn) para receber, junto a cada item, `employee_ids: string[]`. Fluxo dentro do handler (mantendo o débito/estorno atuais via `confirm_scheduled_deliveries` RPC):

1. Chama o RPC existente com `items: [{date, meals_count: employee_ids.length}]` — mantém o débito FIFO de créditos.
2. Para cada dia confirmado, busca o `scheduled_deliveries.id` resultante (mesmo `user_id`, mesma data, `status='scheduled'`).
3. Faz `DELETE FROM delivery_employees WHERE company_id=auth.uid() AND delivery_date=<ymd>` (substitui o conjunto anterior) e `INSERT` dos novos `employee_ids` com `status='confirmado'` e `scheduled_delivery_id` vinculado.
4. Se `employee_ids.length === 0`, apenas remove os `delivery_employees` daquele dia (a entrega já é cancelada via RPC quando `meals_count=0`).

A diferença de créditos é tratada naturalmente pelo RPC, que compara com `scheduled_deliveries.meals_count` atual.

### 6. Desativação em `/app/equipe` com agendamentos futuros

Antes do `UPDATE employees SET is_active=false`:

1. Consultar `delivery_employees` onde `employee_id = X`, `status='confirmado'`, `delivery_date >= hoje`.
2. Se houver registros, abrir modal "Este funcionário está incluído em X agendamento(s) futuro(s). Deseja removê-lo desses agendamentos e estornar os créditos correspondentes?" com botões "Cancelar" e "Desativar e estornar créditos" (vermelho).
3. Ao confirmar, chamar nova server fn `deactivateEmployeeWithRefund({ employee_id })` que:
   - Marca os `delivery_employees` futuros como `cancelado`.
   - Para cada `scheduled_delivery_id` afetado, faz `UPDATE scheduled_deliveries SET meals_count = meals_count - <removidos>` (ou cancela a entrega se zerar) e insere um `credit_transactions` `kind='refund'` com `delta` positivo igual ao número removido — o trigger `recalc_client_credits` recalcula `client_credits`.
   - Marca `employees.is_active = false`.

Sem agendamento futuro, comportamento atual permanece.

### Detalhes técnicos

- **Arquivos novos**:
  - migration `delivery_employees` (CREATE TABLE + GRANTs + RLS + índices)
  - `src/components/app/EmployeeSelectionDialog.tsx`
  - `src/lib/employees.functions.ts` (server fns: `deactivateEmployeeWithRefund` e helper `listDeliveryEmployeesForWeeks` se necessário)
- **Arquivos editados**:
  - `src/routes/app.agendamentos.tsx` — troca `draft: number` por `draftEmployees: string[]`, novo `DayCard`, carrega `employees` e `delivery_employees`
  - `src/lib/scheduling.functions.ts` — input passa a aceitar `employee_ids: string[]` por item; após o RPC, sincroniza `delivery_employees`
  - `src/routes/app.equipe.tsx` — intercepta deactivate com modal de confirmação
- **Tipos**: `src/integrations/supabase/types.ts` é regenerado automaticamente após a migration.
- **Estados de carga** e mensagens de erro seguem o padrão atual (toast/sonner + `Loader2`).

### Confirmação

Se aprovado, primeiro envio a migration (ela precisa rodar antes do código compilar contra os novos tipos), e em seguida implemento as alterações de UI e server functions em uma única leva.
