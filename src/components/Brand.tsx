import { Link } from 'react-router-dom'

export function Brand() {
  return <Link className="brand" to="/" aria-label="Voo BQ — início">
    <span className="brand-mark">BQ</span>
    <span><strong>Voo BQ</strong><small>Expô Bentinho</small></span>
  </Link>
}
