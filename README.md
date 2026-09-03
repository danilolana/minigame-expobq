# Voo BQ — Minigame com ranking global

Minigame React/Vite controlado pela câmera. O jogador conduz o pássaro com o rosto, decide se descarta a tentativa ou a salva no ranking global e consulta os dez melhores voos.

## Premissas e arquitetura

- Frontend existente: React + Vite + TypeScript, com MediaPipe executado integralmente no navegador.
- Hospedagem: Vercel, usando `api/leaderboard.ts` como Node.js Function no mesmo domínio do jogo.
- Persistência: Supabase Postgres. O navegador nunca recebe uma chave secreta nem acessa a tabela diretamente.
- Uma tentativa descartada não gera escrita. Uma tentativa salva usa um token HMAC de uso único (`run_id`) e passa por validação de nome, faixa e pontuação plausível para o tempo de jogo.

```text
Jogo no navegador ── GET/POST /api/leaderboard ── Vercel Function ── Supabase
       │                         │
       └── descartar: local      └── segredo somente no servidor
```

Essa proteção eleva o custo de adulteração e bloqueia replay, mas não substitui simulação autoritativa no servidor. Em um jogo competitivo com prêmio, a física e a pontuação devem ser validadas pelo backend.

## Configuração

Requer Node.js 20 ou superior.

```bash
npm install
```

1. Vincule a CLI ao projeto Supabase e aplique a migration:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

2. Copie `.env.example` para `.env.local` e preencha:

- `SUPABASE_URL`: URL do projeto.
- `SUPABASE_SECRET_KEY`: chave secreta moderna `sb_secret_...`. A chave legada `SUPABASE_SERVICE_ROLE_KEY` também é aceita por compatibilidade.
- `RUN_TOKEN_SECRET`: valor aleatório com no mínimo 32 caracteres, diferente por ambiente.

Nunca use prefixo `VITE_` nessas variáveis. Configure os mesmos nomes em **Vercel → Project Settings → Environment Variables**, com valores separados para Preview e Production.

3. Para testar frontend e Function juntos:

```bash
npx vercel dev
```

`npm run dev` executa apenas o Vite; nesse modo o jogo continua funcionando, mas o ranking fica indisponível.

## Validação

```bash
npm test
npm run build
npm audit
```

Os testes cobrem validação de apelido, contrato HTTP do cliente, descarte sem token persistível, transição de salvamento, assinatura/adulteração/expiração do token e limite plausível de pontuação.

## Decisões de experiência e desempenho

- O ranking mostra cinco posições no desktop e três no celular, embora a API mantenha o top 10.
- Trilha de partículas, parallax, brilho dos portais, telemetria e impacto são desenhados no mesmo `canvas`, sem imagens extras ou chamadas por frame.
- `prefers-reduced-motion` desativa a trilha e encurta animações CSS.
- A câmera é encerrada assim que há colisão; nenhuma imagem é enviada ao servidor.
- Falha do ranking é degradável: nunca impede uma partida local.

## Operação

Depois de aplicar a migration, rode os advisors de segurança e desempenho do Supabase. Para exposição pública, adicione rate limiting em `/api/leaderboard` pelo Vercel Firewall. A tabela mantém RLS habilitado e revoga acesso de `anon`/`authenticated`; somente a Function com a chave secreta lê e grava.
