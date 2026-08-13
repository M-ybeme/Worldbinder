import type { ReactNode } from 'react'
import './PageHeader.css'

export interface PageHeaderProps {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, meta, actions }: PageHeaderProps) {
  return (
    <header className="wb-page-header">
      <div className="wb-page-header__heading">
        <h1 className="wb-page-header__title">{title}</h1>
        {meta && <div className="wb-page-header__meta">{meta}</div>}
      </div>
      {actions && <div className="wb-page-header__actions">{actions}</div>}
    </header>
  )
}
