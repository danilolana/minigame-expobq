import { useState, type FormEvent } from 'react'
import { Brand } from '../components/Brand'

export function AdminLoginPage({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await onLogin(username, password) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível entrar.') }
    finally { setBusy(false) }
  }
  return <main className="admin-login-page"><header className="app-header"><Brand /></header>
    <form className="admin-login" onSubmit={(event) => void submit(event)}>
      <span className="eyebrow">Acesso restrito</span><h1>Painel administrativo</h1><p>Entre com as credenciais configuradas no ambiente da aplicação.</p>
      <label>Usuário<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
      <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-action" disabled={busy}>{busy ? 'Verificando…' : 'Entrar'}</button>
    </form>
  </main>
}
