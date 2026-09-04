import { NavLink } from 'react-router-dom'

export function Navigation({ admin = false, onLogout }: { admin?: boolean; onLogout?: () => void }) {
  return <nav className="navigation" aria-label="Navegação principal">
    {admin && <NavLink to="/adm">Dashboard</NavLink>}
    <NavLink to="/">Jogar</NavLink>
    <NavLink to="/ranking">Ranking</NavLink>
    {admin && <button type="button" onClick={onLogout}>Sair</button>}
  </nav>
}
