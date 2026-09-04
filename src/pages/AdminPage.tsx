import { useCallback, useEffect, useState } from 'react'
import { AdminStats } from '../components/AdminStats'
import { Brand } from '../components/Brand'
import { ConfirmModal } from '../components/ConfirmModal'
import { Navigation } from '../components/Navigation'
import { RankingTable } from '../components/RankingTable'
import { RoundHistory } from '../components/RoundHistory'
import { getAdminDashboard, getAdminSession, getRoundHistory, loginAdmin, logoutAdmin, resetRanking, type AdminDashboard, type RoundHistoryItem } from '../lib/admin'
import { AdminLoginPage } from './AdminLoginPage'

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '—'
const runLabel = { started: 'Em andamento', accepted: 'Aceita', rejected: 'Rejeitada', expired: 'Expirada' }

export function AdminPage() {
  const [session, setSession] = useState<'loading' | 'anonymous' | 'authenticated'>('loading')
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [rounds, setRounds] = useState<RoundHistoryItem[]>([])
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [nextDashboard, nextRounds] = await Promise.all([getAdminDashboard(), getRoundHistory()])
      setDashboard(nextDashboard); setRounds(nextRounds); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao carregar o painel.') }
  }, [])
  useEffect(() => { void getAdminSession().then(() => setSession('authenticated')).catch(() => setSession('anonymous')) }, [])
  useEffect(() => {
    if (session !== 'authenticated') return
    void refresh(); const poll = window.setInterval(() => void refresh(), 12_000)
    return () => window.clearInterval(poll)
  }, [refresh, session])

  if (session === 'loading') return <main className="admin-loading">Verificando sessão…</main>
  if (session === 'anonymous') return <AdminLoginPage onLogin={async (username, password) => { await loginAdmin(username, password); setSession('authenticated') }} />

  const logout = async () => { await logoutAdmin(); setSession('anonymous'); setDashboard(null) }
  const confirmReset = async () => {
    setResetting(true); setError('')
    try { await resetRanking(); setShowReset(false); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível reiniciar.') }
    finally { setResetting(false) }
  }
  const duration = dashboard ? Math.max(0, Math.floor((Date.now() - Date.parse(dashboard.round.startedAt)) / 60000)) : 0

  return <main className="admin-page"><header className="app-header admin-header"><Brand /><Navigation admin onLogout={() => void logout()} /></header>
    <section className="admin-hero"><div><span className="eyebrow">Painel administrativo</span><h1>Controle de rodada</h1></div>
      <div className="round-beacon"><i /><span>Rodada</span><strong>#{dashboard?.round.number ?? '—'}</strong><b>Ativa</b></div>
      <button className="danger-action" onClick={() => setShowReset(true)}>Reiniciar ranking</button></section>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {!dashboard && !error && <p className="admin-loading-inline">Carregando telemetria…</p>}
    {dashboard && <>
      <AdminStats dashboard={dashboard} />
      <section className="admin-summary"><article><span>Início da rodada</span><strong>{formatDate(dashboard.round.startedAt)}</strong></article><article><span>Duração</span><strong>{duration} min</strong></article><article><span>Última atividade</span><strong>{formatDate(dashboard.stats.lastActivity)}</strong></article><article><span>Status do sistema</span><strong className="system-ok"><i /> Operacional</strong></article></section>
      <div className="admin-columns"><section className="admin-panel"><div className="panel-heading"><div><span>Rodada #{dashboard.round.number}</span><h2>Top 10</h2></div></div>{dashboard.top.length ? <RankingTable entries={dashboard.top} /> : <p className="panel-empty">Ainda não há pontuações nesta rodada.</p>}</section>
        <section className="admin-panel"><div className="panel-heading"><div><span>Atividade recente</span><h2>Últimas partidas</h2></div></div><div className="runs-list">{dashboard.latestRuns.length ? dashboard.latestRuns.map((run) => <article key={run.runId}><div><strong>{run.playerName ?? 'Jogador sem nome'}</strong><span className={`run-status run-status--${run.status}`}>{runLabel[run.status]}</span></div><small>{formatDate(run.startedAt)}{run.score !== null ? ` · ${run.score} pontos` : ''}{run.rejectionReason ? ` · ${run.rejectionReason}` : ''}</small></article>) : <p className="panel-empty">Nenhuma partida iniciada.</p>}</div></section></div>
      <RoundHistory rounds={rounds} />
    </>}
    {showReset && <ConfirmModal busy={resetting} onCancel={() => setShowReset(false)} onConfirm={() => void confirmReset()} />}
  </main>
}
