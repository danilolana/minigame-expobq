# Voo BQ — Minigame por rodadas

Aplicação React/Vite/TypeScript da Expô Bentinho. O jogo usa MediaPipe no navegador, envia toda pontuação pela Function da Vercel e mantém ranking público por rodadas no Supabase.

## Rotas

- `/` e `/jogo`: minigame, câmera, score e envio seguro.
- `/ranking`: top 10 da rodada ativa, Realtime e polling de 12 segundos.
- `/adm`: login administrativo, métricas, partidas, histórico e reset de rodada.

`vercel.json` contém os rewrites necessários para acesso direto às três rotas. As APIs ficam sob `/api`.

## Fluxo e segurança

```text
Jogo ── POST action:start ── start_game_run() ── rodada ativa + game_run
  │                                  │
  └── token HMAC(runId, roundId)     └── token completo nunca é persistido

Score ── validações server-side ── submit_game_score() ── score + run aceito
Admin ── cookie HMAC HttpOnly ── reset_leaderboard_round() ── histórico + nova rodada
```

- O frontend nunca grava scores no Supabase.
- `SUPABASE_SECRET_KEY`, senha administrativa e segredos permanecem server-side.
- O token assinado inclui `runId`, `roundId` e `issuedAt`, expira em 30 minutos e não pode ser reutilizado.
- Uma partida de rodada encerrada é rejeitada; ela nunca migra silenciosamente para a rodada nova.
- O reset usa uma função PostgreSQL transacional e não apaga scores.
- Um índice único parcial impede duas rodadas ativas.
- RLS permite ao cliente público somente `SELECT` da rodada ativa e de seus scores, necessário ao Realtime. Escritas e RPCs críticas são restritas ao `service_role`.

## Banco

A migration `supabase/migrations/20260904120000_add_rounds_admin_and_game_runs.sql`:

1. cria `leaderboard_rounds` e a primeira rodada ativa;
2. associa os scores existentes a ela antes de tornar `round_id` obrigatório;
3. cria `game_runs`;
4. instala as funções transacionais de início, salvamento e reset;
5. cria agregações administrativas, políticas RLS e publicação Realtime.

Aplicação:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Faça backup do banco antes de aplicar migrations em produção.

## Variáveis de ambiente

Copie `.env.example` para `.env.local`. Configure no Vercel:

### Server-only

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `RUN_TOKEN_SECRET` (mínimo 32 caracteres)
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET` (mínimo 32 caracteres)

### Públicas

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

A publishable key é usada somente para receber eventos Realtime. Nunca use a secret key em variável `VITE_`.

## Desenvolvimento e validação

```bash
npm install
npx vercel dev
npm test
npm run build
```

`npm run dev` executa apenas o Vite; sem as Functions, jogo e layout abrem, mas ranking e login ficam indisponíveis. A suíte cobre contratos do cliente, reducer, token e vínculo com rodada, login/sessão/401, handlers do ranking e invariantes da migration.

## Operação

- Configure a replicação Realtime antes do evento; a migration tenta incluir `leaderboard_rounds` e `leaderboard_scores` na publicação `supabase_realtime`.
- Após o deploy, valide login, um score real e reset em Preview antes de usar Production.
- Considere rate limiting para `/api/leaderboard` e `/api/admin/login` no Vercel Firewall.
- Runs iniciadas há mais de 30 minutos são marcadas como expiradas ao carregar o dashboard.

## Identidade visual e desempenho

- Paleta centralizada em azul-noite, azul BQ, branco e dourado; coral é reservado para falhas e ações destrutivas.
- Montserrat Variable é empacotada com a aplicação por `@fontsource-variable/montserrat`, limitada ao subconjunto latino e sem requisição ao Google Fonts.
- Os arquivos oficiais de marca ficam em `public/brand`: brasão no cabeçalho e favicon, logotipo horizontal no selo institucional e monograma dentro do jogo.
- O canvas continua animando via `requestAnimationFrame`, mas a inferência facial é limitada a aproximadamente 30 FPS.
- O `FaceLandmarker` é reutilizado entre partidas e fechado apenas ao sair da página, eliminando downloads e inicializações repetidas.
- A câmera solicita 640×480, resolução suficiente para o ponto facial usado pelo jogo e mais leve que 1280×720.
- Responsividade e `prefers-reduced-motion` cobrem jogo, ranking, login e dashboard.
