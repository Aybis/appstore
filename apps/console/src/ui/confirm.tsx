import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` for anything that removes, revokes or signs someone out. */
  tone?: 'default' | 'danger'
}

type Ask = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Ask | null>(null)

/**
 * The console's one confirmation dialog.
 *
 * Replaces `window.confirm`, which renders as browser chrome — unstyled, with
 * the site's hostname as its title, and blocking the whole tab. A native
 * `<dialog>` opened with `showModal()` keeps what made confirm() safe (focus is
 * trapped, Escape cancels, the page behind is inert) and lets the question read
 * like part of the product.
 */
export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((answer: boolean) => void) | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  const ask = useCallback<Ask>((options) => {
    // A second question while one is open answers the first with "no" rather
    // than leaving its promise hanging forever.
    resolver.current?.(false)
    setPending(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = useCallback((answer: boolean) => {
    resolver.current?.(answer)
    resolver.current = null
    setPending(null)
  }, [])

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (pending && !element.open) element.showModal()
    if (!pending && element.open) element.close()
  }, [pending])

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby="confirm-title"
        // Escape fires `cancel`; treat it as the No it means.
        onCancel={(event) => {
          event.preventDefault()
          settle(false)
        }}
        // A click on the backdrop lands on the dialog element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) settle(false)
        }}
      >
        {pending && (
          <div className="modal-card">
            <h2 id="confirm-title">{pending.title}</h2>
            {pending.body && <div className="modal-body">{pending.body}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => settle(false)}>
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                className={`btn ${pending.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => settle(true)}
                autoFocus
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = (): Ask => {
  const ask = useContext(ConfirmContext)
  if (!ask) throw new Error('useConfirm used outside ConfirmProvider')
  return ask
}
