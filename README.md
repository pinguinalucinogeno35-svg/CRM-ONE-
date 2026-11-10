# CRM ONE

CRM da ONE para seus clientes: leads, funil de vendas e métricas de redes sociais.

Stack: Next.js 16 (App Router) + Supabase (Postgres, Auth, RLS) + Vercel.

## Estado atual: Fase 1 (base)

- Login por e-mail e senha (sem cadastro público; os acessos são criados pela ONE).
- Multi-tenant: cada cliente é uma `organization`; a RLS do banco garante que um
  usuário só enxerga dados do próprio cliente, e apenas enquanto ele estiver ativo.
- Painel da equipe ONE (`/admin`): criar clientes, suspender/reativar, criar e
  remover usuários, gerar nova senha provisória.
- Painel do cliente (`/painel`) e página de conta (`/conta`).

## Fase 2 (leads e funil)

- Leads (`/leads`): cadastro com nome, telefone, motivo, origem, temperatura
  (quente, médio, frio) e etapa; busca por nome ou telefone e filtros.
- Funil (`/funil`): quadro por etapa (Novo, Em contato, Proposta, Fechado,
  Perdido); arrastar um cartão muda a etapa.
- Painel (`/painel`): leads em aberto, por temperatura e por etapa.

## Fase 3 (captura automática)

- Formulário público por cliente em `/f/<token>`; `?origem=instagram` (ou
  `facebook`, `site`...) define a origem do lead. Links prontos em `/captura`.
- WhatsApp: `POST /api/webhooks/meta` recebe as mensagens da WhatsApp Cloud API
  e cria o lead no cliente dono do número (ligado em `/admin` pelo Phone number
  ID). Conversas vindas de anúncio entram com origem "Anúncio".
- Um telefone que já tem lead em aberto no cliente não gera lead duplicado.

Para o webhook funcionar, configure `SUPABASE_SECRET_KEY`, `META_APP_SECRET` e
`META_WEBHOOK_VERIFY_TOKEN`, e cadastre na Meta o endereço
`https://<site>/api/webhooks/meta` assinando o campo `messages`.

## Fase 4 (métricas de redes sociais)

- O cliente conecta Instagram e Facebook em `/redes` (Facebook Login, Graph API
  v27). Os tokens de página ficam cifrados no banco (AES-256-GCM, chave derivada
  de `META_APP_SECRET`).
- A cada atualização guardamos um registro por conta e por dia (seguidores,
  alcance, visualizações, interações) e as 25 últimas publicações do Instagram.
  O histórico fica aqui para sempre; a Meta só devolve janelas curtas.
- Atualização: automática ao abrir a página (dados com mais de 6h), pelo botão
  "Atualizar agora", e diária pelo Cron da Vercel (`/api/cron/sync-social`, que
  exige `CRON_SECRET` e `SUPABASE_SECRET_KEY`).

Configuração na Meta: em Facebook Login, cadastre o redirect
`https://<site>/api/meta/callback`. As permissões usadas estão em
`src/lib/meta/config.ts`; contas que não são administradoras ou testadoras do
app só conseguem conectar depois do App Review.

Testado contra um simulador local da Graph API escrito a partir da
documentação; ainda não testado contra a Meta real.

Ainda não feito: Lead Ads (formulários de anúncio da Meta) e publicações do
Facebook.

## Fase 6 (temperatura automática e resultados)

- A temperatura do lead é calculada no banco por pontos (etapa, intenção no
  motivo, origem e tempo parado); as regras estão em `private.score_lead`, na
  migração `20261110060000`. O lead mostra os motivos, e dá para definir
  manualmente.
- Cada lead tem campanha e valor da venda. Em `/captura` há um gerador de link
  de campanha (`/f/<token>?origem=...&c=<campanha>`).
- `/resultados`: leads, vendas, conversão e valor vendido por origem e por
  campanha, e o caminho do alcance até a venda para as redes conectadas.

Pendência de limpeza no banco: as versões antigas de `submit_public_lead`,
`ingest_channel_lead`, `private.capture_lead` e o gatilho desativado
`leads_set_updated_at_legacy` ainda existem e podem ser removidos.

## Configuração

1. Crie um projeto no Supabase e aplique `supabase/migrations/` (SQL Editor ou CLI).
2. Copie `.env.example` para `.env.local` e preencha as três variáveis.
3. Crie o primeiro usuário da equipe ONE em Authentication > Users > Add user e
   promova-o no SQL Editor:

   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'seu-email@exemplo.com';
   ```

4. Rode o projeto:

   ```bash
   npm install
   npm run dev
   ```

## Estrutura

- `supabase/migrations/` — schema, funções e políticas de RLS.
- `src/proxy.ts` — renova a sessão e redireciona quem não está logado.
- `src/lib/auth.ts` — leitura da sessão e checagem de papel (equipe ONE ou cliente).
- `src/lib/supabase/admin.ts` — cliente com chave secreta, usado só nas ações do `/admin`.
- `src/app/(app)/` — telas autenticadas.

Os ícones são próprios (`src/components/icons.tsx`); não usar emoji como ícone.
