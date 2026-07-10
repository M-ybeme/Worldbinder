import { Outlet } from 'react-router-dom'

export function App() {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <span className="app-shell__brand">Worldbinder</span>
      </header>
      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  )
}
