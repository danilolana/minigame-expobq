import type { RoundHistoryItem } from '../lib/admin'

const date = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Em andamento'
export function RoundHistory({ rounds }: { rounds: RoundHistoryItem[] }) {
  return <section className="admin-panel round-history">
    <div className="panel-heading"><div><span>Arquivo do evento</span><h2>Histórico de rodadas</h2></div></div>
    <div className="round-list">{rounds.map((round) => <article key={round.id}>
      <div><strong>Rodada #{round.number}</strong><span className={round.active ? 'status-active' : ''}>{round.active ? 'Ativa' : 'Finalizada'}</span></div>
      <dl><div><dt>Período</dt><dd>{date(round.startedAt)} — {date(round.endedAt)}</dd></div>
        <div><dt>Jogadores</dt><dd>{round.participants}</dd></div><div><dt>Scores</dt><dd>{round.scoresCount}</dd></div>
        <div><dt>Recorde</dt><dd>{round.highScore}</dd></div><div><dt>Média</dt><dd>{round.averageScore}</dd></div>
        <div><dt>Vencedor</dt><dd>{round.winner ?? '—'}</dd></div></dl>
    </article>)}</div>
  </section>
}
