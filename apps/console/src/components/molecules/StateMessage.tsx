import { Button } from '../atoms/Button'
import { Spinner } from '../atoms/Spinner'

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="state">
    <Spinner />
    <p>{label}</p>
  </div>
)

export const Empty = ({ title, body }: { title: string; body: string }) => (
  <div className="state">
    <h3>{title}</h3>
    <p>{body}</p>
  </div>
)

export const Failed = ({ error, onRetry }: { error: string; onRetry?: () => void }) => (
  <div className="state state-error">
    <h3>Something went wrong</h3>
    <p>{error}</p>
    {onRetry && (
      <Button variant="ghost" size="sm" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
)
