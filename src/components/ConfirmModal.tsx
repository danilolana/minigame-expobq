import { useEffect, useRef } from 'react'

export function ConfirmModal({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancelRef.current?.focus() }, [])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
    <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
      <span className="danger-label">Encerrar rodada</span>
      <h2 id="reset-title">Reiniciar o ranking?</h2>
      <p>Todas as pontuações continuarão salvas no histórico, mas o ranking público começará novamente do zero.</p>
      <div><button ref={cancelRef} className="secondary-action" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="danger-action" onClick={onConfirm} disabled={busy}>{busy ? 'Iniciando nova rodada…' : 'Encerrar e iniciar nova'}</button></div>
    </section>
  </div>
}
