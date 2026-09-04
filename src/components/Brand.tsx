import { Link } from 'react-router-dom'

export function Brand() {
  return <Link className="brand" to="/" aria-label="Voo BQ — início">
    <span className="brand-mark"><img src="/brand/bq-crest.png" alt="" width="50" height="54" /></span>
    <span><strong>Voo BQ</strong><small>Expô Bentinho</small></span>
  </Link>
}
