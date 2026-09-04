import type { RankingEntry } from '../lib/ranking'

export function RankingTable({ entries, offset = 0 }: { entries: RankingEntry[]; offset?: number }) {
  return <ol className="ranking-table" start={offset + 1}>
    {entries.map((entry, index) => <li key={entry.id}>
      <span>{String(index + offset + 1).padStart(2, '0')}</span>
      <strong>{entry.playerName}</strong>
      <b>{entry.score.toLocaleString('pt-BR')}</b>
    </li>)}
  </ol>
}
