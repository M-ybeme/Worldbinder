import { createBrowserRouter } from 'react-router-dom'
import { App } from '../app/App'
import { StatusPage } from '../features/system-status/pages/StatusPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [{ index: true, element: <StatusPage /> }],
  },
])
