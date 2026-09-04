import { useCallback, useEffect, useRef, useState } from 'react'
import { Brand } from '../components/Brand'
import { Navigation } from '../components/Navigation'
import { RankingPodium } from '../components/RankingPodium'
import { RankingTable } from '../components/RankingTable'
import { loadRanking, type LeaderboardSnapshot } from '../lib/ranking'
import { getPublicSupabase } from '../lib/supabase'

export function RankingPage() {
  const [snapshot, setSnapshot] = useState<LeaderboardSnapshot | null>(null)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(false)
  const latestRef = useRef<string>('')
  const refresh = useCallback(async () => {
    try {
      const next = await loadRanking()
      const fingerprint = `${next.round.id}:${next.entries.map((entry) => `${entry.id}:${entry.score}`).join(',')}`
      if (latestRef.current && latestRef.current !== fingerprint) {
        setUpdated(true); window.setTimeout(() => setUpdated(false), 700)
      }
      latestRef.current = fingerprint; setSnapshot(next); setError('')
    } catch { setError('Não foi possível sincronizar o ranking. Nova tentativa em instantes.') }
  }, [])

  useEffect(() => {
    void refresh()
    const poll = window.setInterval(() => void refresh(), 12_000)
    const supabase = getPublicSupabase()
    const channel = supabase?.channel('public-leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard_scores' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard_rounds' }, () => void refresh())
      .subscribe()
    return () => { window.clearInterval(poll); if (channel && supabase) void supabase.removeChannel(channel) }
  }, [refresh])

  return <main className={`ranking-page ${updated ? 'is-updated' : ''}`}>
    <header className="app-header ranking-header"><Brand /><div className="live-round"><i /><span>Rodada ativa</span><strong>#{snapshot?.round.number ?? '—'}</strong></div><Navigation /></header>
    <section className="ranking-stage" aria-live="polite">
      <div className="ranking-title"><span>Classificação ao vivo</span><h1>Radar de pilotos</h1><p>Os dez melhores voos da rodada atual.</p></div>
      {!snapshot && !error && <div className="ranking-empty"><span>Sincronizando</span><h2>Buscando os melhores voos…</h2></div>}
      {error && !snapshot && <div className="ranking-empty ranking-empty--error"><span>Sem sinal</span><h2>{error}</h2></div>}
      {snapshot && snapshot.entries.length === 0 && <div className="ranking-empty"><span>Rodada #{snapshot.round.number} iniciada</span><h2>Seja o primeiro a entrar no ranking!</h2><p>Jogue agora e inaugure o placar.</p></div>}
      {snapshot && snapshot.entries.length > 0 && <div className="ranking-results"><RankingPodium entries={snapshot.entries} />{snapshot.entries.length > 3 && <RankingTable entries={snapshot.entries.slice(3)} offset={3} />}</div>}
    </section>
    <footer className="ranking-footer"><span>{error || 'Atualização automática ativa'}</span><span>Expô Bentinho · Voo BQ</span></footer>
  </main>
}
