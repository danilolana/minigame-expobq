import type { AdminDashboard } from '../lib/admin'

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
export function AdminStats({ dashboard }: { dashboard: AdminDashboard }) {
  const { stats } = dashboard
  const rate = stats.started ? Math.round((stats.accepted / stats.started) * 100) : 0
  const items = [
    ['Partidas iniciadas', stats.started], ['Pontuações aceitas', stats.accepted],
    ['Tentativas rejeitadas', stats.rejected], ['Taxa de conclusão', `${rate}%`],
    ['Jogadores únicos', stats.uniquePlayers], ['Maior pontuação', number(stats.highScore)],
    ['Média', number(stats.averageScore)], ['Menor pontuação', number(stats.lowScore)],
  ]
  return <section className="stats-grid" aria-label="Métricas da rodada">
    {items.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
  </section>
}
