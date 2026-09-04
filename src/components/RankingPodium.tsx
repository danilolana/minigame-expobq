import type { RankingEntry } from '../lib/ranking'

export function RankingPodium({ entries }: { entries: RankingEntry[] }) {
  return <ol className="ranking-podium" aria-label="Três melhores jogadores">
    {entries.slice(0, 3).map((entry, index) => <li key={entry.id} className={`podium-place podium-place--${index + 1}`}>
      <span>{String(index + 1).padStart(2, '0')}</span>
      <strong>{entry.playerName}</strong>
      <b>{entry.score.toLocaleString('pt-BR')}</b>
      <small>pontos</small>
    </li>)}
  </ol>
}
