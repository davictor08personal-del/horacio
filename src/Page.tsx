import type { ReactNode } from 'react'
import { ICON, Icon } from './NoteEditor'

/** A full screen pushed over the current one, as on iOS: «‹ back» on the left, the content scrolls below. */
export default function Page({ back, onBack, actions, children }: { back: string; onBack: () => void; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="page" role="dialog">
      <header className="note-bar">
        <button className="back" onClick={onBack}><Icon d={ICON.back} />{back}</button>
        <div className="note-bar-actions">{actions}</div>
      </header>
      <div className="page-scroll">{children}</div>
    </div>
  )
}
