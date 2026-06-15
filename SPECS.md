# SPECS.md — Pratô VIP Business

> Documento de especificação técnica gerado a partir do estado atual do repositório.
> Plataforma B2B para gestão de marmitas corporativas: o cliente (empresa) compra pacotes
> de créditos, cadastra colaboradores, agenda entregas diárias e o admin Pratô gerencia
> cardápios, pacotes, produção, pagamentos, clientes, suporte e documentos legais.

---

## Sumário

1. [Visão geral do produto](#1-visão-geral-do-produto)
2. [Stack tecnológica](#2-stack-tecnológica)
3. [Organização de pastas](#3-organização-de-pastas)
4. [Banco de dados (Lovable Cloud / Supabase)](#4-banco-de-dados-lovable-cloud--supabase)
5. [Autenticação e autorização](#5-autenticação-e-autorização)
6. [Camada server (TanStack `createServerFn`)](#6-camada-server-tanstack-createserverfn)
7. [Roteamento e telas](#7-roteamento-e-telas)
8. [Lógica de negócio crítica](#8-lógica-de-negócio-crítica)
9. [Design system](#9-design-system)
10. [Bibliotecas utilitárias](#10-bibliotecas-utilitárias)
11. [Integrações externas](#11-integrações-externas)
12. [Convenções e regras importantes](#12-convenções-e-regras-importantes)

---

## 1. Visão geral do produto

**Pratô** é uma plataforma de alimentação corporativa. Três personas:

- **Visitante (landing pública):** vê pacotes, cardápio, deixa lead ou inicia checkout.
- **Cliente (empresa logada — role `client`):** painel `/app` para gerir equipe,
  comprar créditos, agendar entregas semanais, ver histórico e abrir tickets de suporte.
- **Admin Pratô (role `admin`, e-mails `@pratoservicos.com`):** painel `/admin` para
  CRUD de cardápios, pacotes, aprovação de pagamentos, fila de produção do dia,
  clientes, suporte e edição dos documentos legais.

Modelo de monetização: o admin **aprova manualmente** o pagamento PIX/Boleto após
receber comprovante via WhatsApp. A aprovação credita créditos (1 crédito = 1 marmita)
na carteira do cliente, com **validade de 6 meses**. O cliente consome créditos ao
**confirmar agendamentos** (mínimo de 3 marmitas/dia por entrega). Bloqueio de edição
ocorre **24h antes da entrega** (entrega às 11:00 BRT).

---

## 2. Stack tecnológica

- **Framework:** TanStack Start v1 (React 19 + Vite 7), SSR, file-based routing.
- **Runtime alvo:** Cloudflare Workers (`@cloudflare/vite-plugin`, `wrangler.jsonc`).
- **Backend / banco:** Lovable Cloud (Supabase gerenciado) — Postgres + Auth + Realtime.
- **Server logic:** `createServerFn` do `@tanstack/react-start`. **Não há Edge Functions.**
- **UI:** shadcn/ui (Radix), Tailwind v4 (`src/styles.css` com `oklch`), `lucide-react`.
- **Forms & validação:** `react-hook-form` + `zod`. Toasts via `sonner`.
- **Datas:** helpers próprios em `src/lib/scheduling.ts` (TZ `America/Sao_Paulo` BRT, UTC-3).
- **Estado de servidor leve:** `@tanstack/react-query` está instalado, mas a maioria
  das rotas usa `useEffect` + `supabase` diretamente; algumas usam `useServerFn`.
- **Auth social:** OAuth Google via broker `@lovable.dev/cloud-auth-js`
  (`src/integrations/lovable/index.ts`), nunca `supabase.auth.signInWithOAuth` diretamente.

---

## 3. Organização de pastas

```
src/
├── routes/                       # file-based routing (TanStack)
│   ├── __root.tsx                # shell HTML, AuthProvider, Toaster, NotFound
│   ├── index.tsx                 # Landing pública
│   ├── login.tsx                 # Login email/senha + Google
│   ├── reset-password.tsx        # PKCE / implicit / sessão ativa
│   ├── checkout.tsx              # Cadastro de empresa + cria conta
│   ├── pagamento.tsx             # Instruções PIX / boleto / WhatsApp
│   ├── interesse.tsx             # Formulário lead
│   ├── termos.tsx, privacidade.tsx
│   ├── app.tsx                   # Layout cliente (sidebar + guard)
│   ├── app.index.tsx             # Visão geral cliente
│   ├── app.agendamentos.tsx      # Agenda semanal (lógica crítica)
│   ├── app.equipe.tsx            # CRUD de funcionários
│   ├── app.comprar.tsx           # Catálogo + criar pedido pendente
│   ├── app.creditos.tsx          # Extrato de transações + pendentes
│   ├── app.historico.tsx         # Entregas marcadas como "delivered"
│   ├── app.suporte.tsx           # Tickets do cliente
│   ├── app.configuracoes.tsx     # Perfil, endereço, troca de senha
│   ├── admin.tsx                 # Layout admin (guard de role)
│   ├── admin.index.tsx           # KPIs e leads recentes
│   ├── admin.cardapio.tsx        # Cardápio semanal
│   ├── admin.pacotes.tsx         # CRUD de packages
│   ├── admin.producao.tsx        # Fila de produção do dia
│   ├── admin.pagamentos.tsx      # Aprovação de orders pendentes
│   ├── admin.clientes.tsx        # Lista de clientes + saldo
│   ├── admin.suporte.tsx         # Tickets (admin)
│   ├── admin.documentos.tsx     # Edição de Termos / Privacidade
│   └── admin_.login.tsx          # Atalho de login admin (redireciona /login)
│
├── lib/
│   ├── auth.tsx                  # AuthProvider, useAuth, checkAdmin
│   ├── auth.functions.ts         # verifyExistingUser (anti-signup Google)
│   ├── checkout.functions.ts     # createClientAccount, completeCheckoutProfile, registerRepurchaseIntent
│   ├── orders.functions.ts       # createPendingOrder, listPendingOrders, approveOrder
│   ├── employees.functions.ts    # countFutureDeliveriesForEmployee, deactivateEmployeeWithRefund
│   ├── scheduling.functions.ts   # confirmScheduling (sincroniza delivery_employees)
│   ├── scheduling.ts             # helpers BRT, semana útil, isDayEditable
│   ├── menus.functions.ts        # getMenusForWeek, upsertMenu, upsertMenuWeek
│   ├── production.functions.ts   # getProductionOrders, markDeliveryStatus
│   ├── dashboard.functions.ts    # getDashboardOverview
│   ├── format.ts, masks.ts, legal.ts, types.ts, utils.ts
│
├── components/
│   ├── ui/                       # shadcn (todos os primitives)
│   ├── app/{AppSidebar, EmployeeSelectionDialog, ComingSoon}.tsx
│   ├── site/{SiteHeader, SiteFooter, Logo, LegalDocumentView}.tsx
│   └── admin/PageHeader.tsx
│
├── hooks/{use-client-credits, use-mobile}.ts(x)
│
├── integrations/
│   ├── supabase/{client, client.server, auth-middleware, auth-attacher, types}.ts
│   └── lovable/index.ts          # broker OAuth Google
│
├── start.ts                      # registra attachSupabaseAuth como functionMiddleware
├── router.tsx                    # getRouter() + DefaultErrorComponent
├── routeTree.gen.ts              # AUTO-GERADO — não editar
└── styles.css                    # Tailwind v4 + tokens oklch
```

---

## 4. Banco de dados (Lovable Cloud / Supabase)

### 4.1 Tabelas

| Tabela | Finalidade |
|---|---|
| `profiles` | Dados da empresa logada (1↔1 com `auth.users`). |
| `user_roles` | `(user_id, role app_role)`; enum `app_role = {admin, client}`. |
| `packages` | Catálogo de pacotes (créditos, preço, features, bônus). |
| `orders` | Pedido de compra (status `pending` → `paid`/`cancelled`). |
| `credit_transactions` | Lançamentos imutáveis de crédito (compra/consumo/ajuste). |
| `client_credits` | Saldo materializado (`balance`) por `user_id`, recalculado por trigger. |
| `consumption_history` | (legado / histórico opcional de consumo). |
| `scheduled_deliveries` | Entrega de N marmitas em um `scheduled_for` (timestamp UTC). |
| `delivery_employees` | Vincula colaborador específico a uma `scheduled_delivery`. |
| `employees` | Colaboradores cadastrados pela empresa (`company_id = auth.uid()`). |
| `menus` | Cardápio do dia (`menu_date`, `base`, `proteins[2]`, `sides[2]`, `salads[3]`, `dessert`). |
| `leads` | Captura de interesse / checkout (`source = {contact_form, checkout}`). |
| `support_tickets` | Tickets do cliente; `messages jsonb` para thread; `admin_reply` legado. |
| `legal_documents` | Termos e privacidade (`slug` único, conteúdo HTML). |

### 4.2 Colunas-chave

**`profiles`** (PK = `auth.users.id`)
`id uuid, full_name, email, company_name, phone, cnpj, delivery_time time, finance_email, address_cep, address_street, address_number, address_neighborhood, address_complement, created_at, updated_at`.

**`packages`**
`id, name, highlight_tag, credits_amount int (>0), total_price numeric (>=0), price_per_meal_text, advantage_description, bonuses text[], features text[], is_active bool, display_order int, created_at, updated_at`.

**`orders`**
`id, user_id, package_id, credits_amount, total_price, package_name, status ∈ {pending, paid, cancelled}, paid_at, approved_by, created_at, updated_at`.

**`credit_transactions`**
`id, user_id, package_id, delta int (sinal), kind ∈ {purchase, consumption, adjustment}, note, created_at, expires_at`.
*Não existe `kind='refund'`*: estornos são gravados como `adjustment` com `delta > 0`.

**`client_credits`** `user_id PK, balance int default 0, updated_at`.

**`scheduled_deliveries`**
`id, user_id, scheduled_for timestamptz, meals_count int (>0), status ∈ {scheduled, delivered, canceled}, notes, created_at, updated_at`.
**Atenção:** o constraint aceita `canceled` (grafia americana). Há código legado em
`employees.functions.ts` que atualiza para `cancelled` — isso violaria o check; o caminho
ativo de cancelamento real passa pela RPC `confirm_scheduled_deliveries`, que usa
`canceled` corretamente.

**`delivery_employees`**
`id, scheduled_delivery_id, employee_id, delivery_date date, company_id, status ∈ {confirmado, cancelado, entregue}, created_at`.

**`employees`** `id, company_id, name, identifier, department, is_active, is_admin, created_at, updated_at`.

**`menus`** `id, menu_date date, base text, proteins text[2], sides text[2], salads text[3], dessert text, …` — upsert por `menu_date`.

**`leads`** `… status ∈ {novo, em_contato, convertido, descartado}, source ∈ {contact_form, checkout}, accepted_terms_at NOT NULL`.

**`support_tickets`** `subject ∈ {agendamento, entrega, financeiro, outros}, status ∈ {pendente, em_andamento, resolvido}, message (10..2000), admin_reply, messages jsonb`.

### 4.3 Check constraints (resumo)

- `packages_credits_amount_check`: `credits_amount > 0`
- `packages_total_price_check`: `total_price >= 0`
- `scheduled_deliveries_meals_count_check / _positive`: `meals_count > 0`
- `scheduled_deliveries_status_check`: `{scheduled, delivered, canceled}`
- `credit_transactions_kind_check`: `{purchase, consumption, adjustment}`
- `delivery_employees_status_check`: `{confirmado, cancelado, entregue}`
- `orders_status_check`: `{pending, paid, cancelled}`
- `leads_status_check`: `{novo, em_contato, convertido, descartado}`
- `leads_source_check`: `{contact_form, checkout}`
- `support_tickets_*`: subject enum, status enum, length(message) ∈ [10, 2000]

### 4.4 Funções e triggers

Funções (todas em `public`, `SECURITY DEFINER` com `search_path=public`):

- **`has_role(_user_id uuid, _role app_role) → boolean`** — chave anti-recursão em RLS.
- **`auto_assign_user_role()`** — trigger em `auth.users`. E-mails `@pratoservicos.com`
  recebem `admin`; demais recebem `client`.
- **`enforce_admin_email_domain()`** — impede inserção/atualização de `user_roles.role='admin'`
  para e-mails fora do domínio `@pratoservicos.com`.
- **`handle_new_user()`** — cria/upserta linha em `profiles` a partir de `raw_user_meta_data`.
- **`set_updated_at()`** — utilitário para colunas `updated_at`.
- **`recalc_client_credits()`** — após qualquer mudança em `credit_transactions`,
  recalcula `SUM(delta) WHERE expires_at IS NULL OR expires_at > now()` e upserta em
  `client_credits`.
- **`cnpj_exists(_cnpj text) → boolean`** — normaliza dígitos e valida tamanho 14.
- **`confirm_scheduled_deliveries(_items jsonb) → jsonb`** — **RPC central de
  agendamento.** Detalhada em §8.1.
- **`prevent_admin_field_changes_on_tickets()`** — impede usuários comuns de alterar
  `admin_reply`, `resolved_by`, `resolved_at`, `user_id`.

### 4.5 RLS (resumo)

- `profiles`: usuário lê/atualiza o próprio; admin vê todos.
- `packages`: público lê ativos; admin gerencia tudo.
- `orders`, `credit_transactions`, `client_credits`, `consumption_history`: usuário lê os próprios; admin gerencia.
- `scheduled_deliveries`: usuário (authenticated) faz CRUD dos próprios em `status='scheduled'`; admin tudo.
- `delivery_employees`, `employees`: empresa (`auth.uid() = company_id`) faz CRUD próprio; admin tudo.
- `menus`, `legal_documents`: qualquer um lê; admin gerencia.
- `leads`: insert público sob filtros estritos (regex e-mail, tamanhos, `accepted_terms_at <= now()`); leitura/edição apenas admin.
- `support_tickets`: cliente insere e lê os próprios; admin lê/atualiza todos. Trigger bloqueia mudanças em campos administrativos por não-admins.
- `user_roles`: select apenas autenticado; admin gerencia.

### 4.6 Storage / Secrets

- **Buckets:** nenhum.
- **Secrets:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_DB_URL`, `LOVABLE_API_KEY`.

---

## 5. Autenticação e autorização

### 5.1 Cliente browser (`AuthProvider`, `src/lib/auth.tsx`)

- Mantém `session`, `user`, `isAdmin`, `loading`.
- `signIn(email, password)` via `supabase.auth.signInWithPassword`.
- `signOut()` limpa `sessionStorage` (flags OAuth: `oauth_in_progress`,
  `oauth_verified_<userId>`) e chama `supabase.auth.signOut()`.
- `checkAdmin(userId)` lê `user_roles` filtrando `role='admin'` (`maybeSingle`).
- Listener `onAuthStateChange`: sempre que a sessão muda, dispara `checkAdmin` via
  `setTimeout(0)` para evitar deadlock interno do Supabase.

### 5.2 OAuth Google (via Lovable broker)

`src/integrations/lovable/index.ts` expõe `lovable.auth.signInWithOAuth(provider, opts)`.
Em `/login`, após redirect:
1. Flag `oauth_verified_<userId>` no `sessionStorage` evita reverificação.
2. Se `email` termina em `@pratoservicos.com`, redireciona para `/admin` direto.
3. Senão, chama o server fn **`verifyExistingUser`** (`src/lib/auth.functions.ts`):
   - lê `auth.admin.getUserById`; se `|last_sign_in_at - created_at| < 15s`,
     assume **signup** indevido via Google, **deleta o usuário** e retorna `signup_blocked`.
   - Em caso de bloqueio, força `signOut()` e mostra toast "conta não encontrada".

### 5.3 Server-side (TanStack)

- **`src/integrations/supabase/auth-middleware.ts`** — `requireSupabaseAuth`:
  exige header `Authorization: Bearer <jwt>`, valida via `supabase.auth.getClaims`,
  injeta `context.supabase` (escopado ao usuário, respeita RLS), `context.userId`,
  `context.claims`.
- **`src/integrations/supabase/auth-attacher.ts`** — middleware client-side registrado
  em `src/start.ts` como `functionMiddleware`. Lê `supabase.auth.getSession()` e
  anexa o bearer a toda chamada de server fn automaticamente.
- **`src/integrations/supabase/client.server.ts`** — `supabaseAdmin` (Service Role)
  para operações que precisam bypass de RLS (criação de auth user, leitura de outros
  perfis, escrita em `credit_transactions` por terceiros, etc.).
- **`src/integrations/supabase/client.ts`** — cliente browser comum.

### 5.4 Guards de rota

Não há layout `_authenticated` neste projeto. O guard é feito **em cada layout**:

- `/app/*` (`app.tsx`): `useAuth()` → se `!user` após `loading`, `navigate('/login')`.
- `/admin/*` (`admin.tsx`): igual; e se `!isAdmin`, exibe tela "Acesso negado" com botão de sair.
- Rotas privadas marcam `head.meta: robots = noindex, nofollow`.

---

## 6. Camada server (TanStack `createServerFn`)

Todas as funções vivem em `src/lib/*.functions.ts`, protegidas por `requireSupabaseAuth`
(salvo `createClientAccount`, que é pública). Lista completa:

### `auth.functions.ts`
- **`verifyExistingUser()`** → valida que a sessão atual é de usuário pré-existente; deleta novo signup Google (`< 15s` entre `created_at` e `last_sign_in_at`).

### `checkout.functions.ts`
- **`createClientAccount(...)`** *(público)*: pré-checa CNPJ; cria `auth.users` via
  `auth.admin.createUser` (`email_confirm: true`); insere `leads` (source=`checkout`,
  status=`convertido`); atualiza `profiles.cnpj/phone`; se `package_id`, cria `order`
  status `pending`. Retorna `{ok, email, order_id}`. Erros mapeados: `cnpj_exists`,
  `email_exists`, `create_failed`.
- **`completeCheckoutProfile(...)`**: upserta `profiles` + insere `lead` para usuário já logado.
- **`registerRepurchaseIntent({package_id})`**: registra lead de recompra (cliente já logado).

### `orders.functions.ts`
- **`createPendingOrder({package_id})`**: snapshot `(credits_amount, total_price,
  package_name)` no momento da criação.
- **`listPendingOrders()`** *(admin)*: orders `pending` + map de profiles.
- **`approveOrder({order_id})`** *(admin)*: insere `credit_transactions` com
  `kind='purchase'`, `delta=credits_amount`, `expires_at = now() + 6 meses`,
  `note='Compra de Pacote — <name>'`. Atualiza `order` para `paid` + `paid_at` + `approved_by`.

### `scheduling.functions.ts`
- **`confirmScheduling({items: [{date, employee_ids}]})`**:
  1. Valida cada dia: `isDayEditable` (cutoff 24h), mínimo 3 funcionários (ou 0 para cancelar), sem duplicados.
  2. Chama RPC `confirm_scheduled_deliveries` com `_items: [{date, meals_count}]`.
  3. Para cada dia, **substitui o conjunto** em `delivery_employees`:
     deleta linhas existentes da empresa naquela data; busca a `scheduled_delivery`
     vigente (`status='scheduled'`, `scheduled_for = ymdToScheduledForIso(date)`);
     insere as novas com `status='confirmado'`.
  4. Retorna `{ok, newBalance, debited, refunded}`.

### `employees.functions.ts`
- **`countFutureDeliveriesForEmployee({employee_id})`**: conta `delivery_employees`
  futuros com `status='confirmado'`.
- **`deactivateEmployeeWithRefund({employee_id})`**: valida posse;
  cancela `delivery_employees` futuros (`status='cancelado'`); para cada
  `scheduled_delivery` afetada, reduz `meals_count` (ou cancela se zerar);
  insere `credit_transactions` com `kind='adjustment'` (estorno);
  marca employee `is_active=false`; retorna `{ok, refunded, newBalance}`.
  *(Bug conhecido legado: usa `status='cancelled'` em `scheduled_deliveries`,
  grafia incompatível com o check constraint — caminho raro/secundário.)*

### `menus.functions.ts`
- **`getMenusForWeek({weekStartYmd, days=5})`**: gera vetor de datas e busca por `in()`.
- **`upsertMenu(menuItem)`** / **`upsertMenuWeek({items[1..7]})`**: upsert por `menu_date`.

### `production.functions.ts`
- **`getProductionOrders({date})`** *(admin)*: janela BRT 00:00→00:00; junta
  `scheduled_deliveries` ∈ {scheduled, delivered} com `profiles`; ordena por
  `delivery_time` depois `company_name`; retorna `{totalMeals, totalClients, items[]}`.
- **`markDeliveryStatus({delivery_id, status: scheduled|delivered})`** *(admin)*.

### `dashboard.functions.ts`
- **`getDashboardOverview()`**: paralela 3 queries — `profiles`, `client_credits`,
  próxima `scheduled_delivery` futura. Retorna `{companyName, email, creditsBalance, nextDelivery}`.

---

## 7. Roteamento e telas

### 7.1 Públicas

- **`/` (`index.tsx`)** — Landing. Hero, Benefícios, Como Funciona, Sobre Nós,
  Pacotes (carrega `packages` ativos ordenados por `display_order`), CTA final, footer.
- **`/login`** — Email/senha + botão Google (via broker). Tela única para clientes
  E admins (redireciona por domínio de e-mail após login). Inclui "Esqueci a senha"
  via `prompt` → `resetPasswordForEmail`.
- **`/reset-password`** — Suporta fluxo PKCE (`?code=...` → `exchangeCodeForSession`),
  fluxo implicit (`#access_token=...` com polling 200ms × 20), e sessão já ativa.
  Estados: `validating | ready | invalid`. Em "ready", form para nova senha
  (`auth.updateUser({password})`).
- **`/checkout?pacote=<uuid>`** — Form cadastro (`company_name`, `cnpj`, `phone`,
  `email`, `password`, aceite termos). Validação com Zod. Chama `createClientAccount`;
  em sucesso, faz `signInWithPassword` e navega para `/pagamento?order=<id>`.
- **`/pagamento?order=<uuid>` ou `?pacote=<uuid>`** — Instruções PIX
  (`PIX_KEY = 30.433.877/0001-37`, `BANK = C6 Bank`), botão WhatsApp
  (`5547996183794`) com mensagem pré-formatada.
- **`/interesse?pacote=<uuid>`** — Form de lead (`source='contact_form'`).
- **`/termos`, `/privacidade`** — Renderizam `legal_documents` por slug
  via `LegalDocumentView`.

### 7.2 Cliente (`/app/*`, layout `app.tsx` com `AppSidebar`)

- **`/app`** — Visão geral: saldo (via `useClientCredits`), próxima entrega, CTAs.
- **`/app/agendamentos`** — Lógica detalhada em §8.2. Navegação semanal
  (`weekOffset`), cards por dia útil (Seg–Sex), bloqueio 24h, modal de seleção
  de funcionários, totais "Esta confirmação" (débito/estorno).
- **`/app/equipe`** — CRUD `employees` (RLS por `company_id`). Diálogo confirma
  desativação com aviso de estorno (chama `deactivateEmployeeWithRefund`).
- **`/app/comprar`** — Lista `packages` ativos, botão "Comprar" → `createPendingOrder`
  → navega `/pagamento?order=<id>`.
- **`/app/creditos`** — Extrato unificado: `credit_transactions` (purchase, consumption,
  adjustment) + `orders pending` mesclados por `created_at` desc.
- **`/app/historico`** — `scheduled_deliveries` com `status='delivered'`.
- **`/app/suporte`** — Lista tickets do usuário (`messages jsonb` thread + `admin_reply`
  legado); form de novo ticket com `subject` enum e mensagem 10–2000 chars.
- **`/app/configuracoes`** — Form de perfil (`profiles`: company_name, phone, cnpj,
  delivery_time, finance_email, endereço completo) e troca de senha.

### 7.3 Admin (`/admin/*`, layout `admin.tsx` com guard de role)

- **`/admin`** — KPIs: pacotes ativos, leads (7d, novos), leads recentes (top 5).
- **`/admin/cardapio`** — Editor semanal de `menus`. Carrega via `getMenusForWeek`,
  salva por dia (`upsertMenu`) ou semana (`upsertMenuWeek`).
- **`/admin/pacotes`** — CRUD de `packages` (incluindo arrays `bonuses` e `features`,
  `display_order`, `is_active`, `highlight_tag`).
- **`/admin/producao`** — Visualização do dia: `getProductionOrders({date})` →
  totais e lista ordenada por horário de entrega. Botão para `markDeliveryStatus`.
- **`/admin/pagamentos`** — Lista `listPendingOrders` e botão "Aprovar" → `approveOrder`.
- **`/admin/clientes`** — Lista `profiles` + saldo de `client_credits` + filtros.
- **`/admin/suporte`** — Inbox de tickets, resposta inline (atualiza `messages jsonb`
  ou `admin_reply`), mudança de `status`.
- **`/admin/documentos`** — Editor de `legal_documents` (textarea HTML por slug;
  Tabs: termos, privacidade).
- **`/admin/login` (`admin_.login.tsx`)** — atalho que redireciona para `/login`.

---

## 8. Lógica de negócio crítica

### 8.1 RPC `confirm_scheduled_deliveries(_items jsonb) → jsonb`

Função principal do agendamento. Trabalha em uma transação:

1. Cria tabela temporária `_scheduling_ops (ymd, scheduled_for, new_count, old_count, existing_id, delta)`.
2. Para cada item `{date, meals_count}`:
   - Valida formato de data, `0 <= meals_count <= 500`, mínimo 3 (ou 0).
   - Calcula `scheduled_for = (date + '11:00')::timestamp AT TIME ZONE 'America/Sao_Paulo'`.
   - **Bloqueio:** `now() >= scheduled_for - 24h` → exceção "não pode mais ser editado".
   - Busca `scheduled_delivery` vigente daquele dia (`status='scheduled'`).
   - Insere op com `delta = new_count - old_count`.
3. Soma `_total_debit` (deltas positivos) e `_total_refund` (negativos).
4. `needed = max(0, debit - refund)`; falha com `{ok:false, reason:'insufficient'}` se saldo < needed.
5. **Débito FIFO por lote (`credit_transactions` com `delta>0` não expirado):**
   ordena por `expires_at NULLS LAST, created_at ASC`; para cada lote, calcula
   `_lot_remaining = lot.delta - SUM(-delta consumos casados por package_id+expires_at)`
   e insere `credit_transactions(kind='consumption', delta=-take, package_id, expires_at, note='Agendamento <ymd, ...>')`.
6. **Estorno:** para cada op com `delta<0`, insere `credit_transactions(kind='adjustment', delta=-delta, expires_at=NULL, note='Estorno agendamento <ymd>')`.
7. Atualiza `scheduled_deliveries`:
   - `new_count=0` → `status='canceled'` (grafia americana — **importante**).
   - `new_count>0` e já existe → `meals_count=new_count`.
   - `new_count>0` e não existe → insert (`status='scheduled'`).
8. Retorna `{ok:true, newBalance, debited, refunded}`.

### 8.2 Tela `app.agendamentos.tsx` (cliente)

- Helpers de fuso (`src/lib/scheduling.ts`): TZ fixo `America/Sao_Paulo` (BRT, UTC-3 sem DST desde 2019).
  - `getWeekDays(offset)` → 5 dias úteis (Seg..Sex).
  - `isDayEditable(ymd)` → bloqueia 24h antes de `11:00 BRT (= 14:00 UTC)`.
  - `MIN_MEALS_PER_DAY = 3`.
  - `ymdToScheduledForIso(ymd) = ${ymd}T14:00:00.000Z`.
- Estados principais:
  - `confirmedEmployeesByYmd` — set já gravado em `delivery_employees` (`status='confirmado'`).
  - `draftEmployees` — só dias **editados na sessão atual**; ausência ≠ "esvaziou".
  - `scheduledByYmd`, `menusByYmd`, `balance`, `loadedWeeks` (cache por offset).
- Agregação **só usa dias presentes em `draftEmployees`**:
  `delta = draft.length - confirmed.length`; soma em `totalDebit` / `totalRefund`.
- Carregamento: 4 queries em paralelo (`scheduled_deliveries`, `client_credits` se primeira
  vez, `menus`, `delivery_employees`). Cliente filtra por janela `[seg, sab)` UTC.
- Envio: chama `confirmScheduling({items})` (server fn). Em sucesso, recarrega.
- Modal `EmployeeSelectionDialog` (componente compartilhado): busca, multi-select,
  valida mínimo (`>=3 ou 0`), atalho "Cadastrar agora" → `/app/equipe`.

### 8.3 Compra de créditos (`comprar` → `pagamento` → `admin/pagamentos`)

```
Cliente clica em pacote (/app/comprar)
   └─> createPendingOrder({package_id})  ← snapshot de preço/qtd
         └─> orders.status='pending'
            └─> navigate /pagamento?order=<id>
                └─> instruções PIX + WhatsApp

Cliente paga via PIX e envia comprovante via WhatsApp.

Admin entra em /admin/pagamentos
   └─> listPendingOrders()
       └─> approveOrder({order_id})
            ├─> insert credit_transactions(kind='purchase', delta=+credits,
            │                              expires_at=now()+6mo,
            │                              package_id, note)
            │     └─> trigger recalc_client_credits → atualiza client_credits.balance
            └─> update orders set status='paid', paid_at, approved_by
```

### 8.4 Lead / Checkout

- Form em `/interesse` → insert direto em `leads` (RLS permite insert público com regras).
- Form em `/checkout` → `createClientAccount` (admin client): pré-checa CNPJ
  duplicado; cria `auth.users`; insere lead `convertido`; atualiza perfil; cria
  `order` pendente se houve `package_id`.

### 8.5 Desativação de funcionário com agendamentos futuros

`deactivateEmployeeWithRefund`:
1. Valida posse (`employees.company_id == userId`).
2. Lista `delivery_employees` futuros confirmados.
3. Agrupa por `scheduled_delivery_id` com `{count, date}`.
4. Marca esses `delivery_employees` como `cancelado`.
5. Para cada delivery: reduz `meals_count`; se zerar, cancela a delivery.
6. Insere `credit_transactions(kind='adjustment', delta=+count, note='Estorno por desativação …')`.
7. Marca `employees.is_active=false`.
8. Retorna `{ok, refunded, newBalance}`.

### 8.6 Saldo de créditos em tempo real

`src/hooks/use-client-credits.ts`:
- Lê inicial via `client_credits.maybeSingle()`.
- Subscreve canal Realtime `client_credits:<userId>` filtrado por `user_id`;
  atualiza `balance` no `payload.new`.

---

## 9. Design system

`src/styles.css` (Tailwind v4 + `tw-animate-css`):

- **Marca:** laranja `--primary ≈ #E85A1F` (oklch 0.66 0.18 38) e verde `--brand-green ≈ #0E6B3A`.
- **Background:** off-white quente `oklch(0.995 0.005 80)`.
- **Tipografia:** Inter (Google Fonts), preconnect em `__root.tsx`.
- **Raio:** `--radius = 0.875rem`, escala derivada (`sm`, `md`, `lg`, `xl`, `2xl`…).
- **Sombras semânticas:** `--shadow-soft`, `--shadow-card`, `--shadow-glow`
  (`color-mix` com primary).
- **Tokens semânticos completos:** `background, foreground, surface, card, popover,
  primary(+foreground/+soft), secondary, brand-green(+foreground/+soft), muted,
  accent, destructive, success, warning, border, input, ring, sidebar.*, chart-1..5`.
- **Dark mode:** variante `dark` definida via `@custom-variant dark (&:is(.dark *))`
  (tokens dark presentes mas não há toggle de tema no app).

shadcn/ui completo em `src/components/ui/*` (acima de 50 primitives).

---

## 10. Bibliotecas utilitárias

- **`src/lib/format.ts`**: `formatBRL`, `formatNumberBR`, `formatDateBR` (pt-BR).
- **`src/lib/masks.ts`**: `maskCNPJ`, `maskPhone`, `maskCEP`, validadores `isValidCNPJ/CEP/Phone/Email`.
- **`src/lib/legal.ts`**: tipo `LegalDocument` + `formatLegalDate`.
- **`src/lib/types.ts`**: tipos `Package`, `Lead`, enums `LeadStatus`/`LeadSource`.
- **`src/lib/scheduling.ts`**: helpers de BRT (`brtParts`, `addDaysYmd`, `mondayOfYmd`,
  `getWeekDays`, `isDayEditable`, `ymdToScheduledForIso`, `formatYmdShort`, `formatYmdRange`,
  `isToday`, `MIN_MEALS_PER_DAY=3`).
- **`src/lib/utils.ts`**: `cn(...)` (clsx + tailwind-merge).
- **`src/hooks/use-mobile.tsx`**: detecção viewport.

---

## 11. Integrações externas

- **Lovable Cloud (Supabase):** banco, auth (email/senha + Google), realtime
  (`client_credits` por `user_id`). Pesquisa via SDK browser e via `requireSupabaseAuth` server-side.
- **Google OAuth:** **somente** via `lovable.auth.signInWithOAuth('google', {redirect_uri})`.
  Nunca chamar `supabase.auth.signInWithOAuth` direto.
- **PIX / Pagamento:** processo manual. Chave CNPJ `30.433.877/0001-37`, banco C6.
- **WhatsApp:** `https://wa.me/5547996183794` com mensagem pré-formatada do pedido.
- **Fontes:** Google Fonts (Inter 400/500/600/700/800).
- **Sem:** Stripe, edge functions, jobs cron, buckets de storage.

---

## 12. Convenções e regras importantes

### 12.1 Arquivos auto-gerados — não editar

- `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`
- `src/integrations/lovable/index.ts`
- `src/routeTree.gen.ts`
- `.env` (Cloud injeta `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`)

### 12.2 Padrões obrigatórios

- **Server fns:** `src/lib/*.functions.ts`, validação com Zod no `.inputValidator()`,
  reads do user via `context.supabase` (RLS); operações privilegiadas via `supabaseAdmin`.
- **`src/start.ts`** deve listar `attachSupabaseAuth` em `functionMiddleware` para
  que cada server fn protegida receba o bearer automaticamente.
- **Sem Edge Functions** (`supabase/functions/*`). Toda lógica server vai em TanStack.
- **Status de delivery:** sempre `canceled` (americano) para `scheduled_deliveries`.
  `cancelled` (britânico) só existe em `orders` (constraint diferente).
- **Status de delivery_employees:** `confirmado | cancelado | entregue` (português).
- **`credit_transactions.kind`:** apenas `purchase | consumption | adjustment`.
  Estornos = `adjustment` com `delta > 0`.

### 12.3 Regras de produto

- **Crédito = 1 marmita**, `expires_at = paid_at + 6 meses`.
- **Mínimo 3 marmitas/dia** ao agendar (ou 0 para cancelar).
- **Bloqueio de edição:** 24h antes da entrega (11:00 BRT do dia agendado).
- **Semana de agendamento:** 5 dias úteis (Seg–Sex) calculados em BRT, com offset.
- **Aprovação de pagamento:** manual via `/admin/pagamentos`.
- **Admin:** apenas e-mails `@pratoservicos.com` (enforced via trigger
  `enforce_admin_email_domain` + função `auto_assign_user_role`).

### 12.4 SEO / Metadados

- `__root.tsx` define metas globais (og:image fixo em R2 da Lovable).
- Cada rota pública (`index, login, checkout, pagamento, interesse, termos, privacidade`)
  define `head.meta` com title/description próprios.
- Rotas privadas marcam `robots: noindex, nofollow`.

### 12.5 Erros e boundaries

- `src/router.tsx` define `DefaultErrorComponent` com retry (`router.invalidate() + reset()`).
- `__root.tsx` define `NotFoundComponent` (404 com CTA "Voltar ao início").

---

> Para regenerar este documento ao receber o comando **"Atualize o SPECS.md"**,
> reanalisar todo o repositório (rotas, libs, banco, RLS, funções) e sobrescrever
> este arquivo inteiro com o estado atual.
