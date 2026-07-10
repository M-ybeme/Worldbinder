import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { StatusPage } from '../features/system-status/pages/StatusPage'

describe('App shell', () => {
  it('renders the brand and the status page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      }),
    )

    const router = createMemoryRouter([
      { path: '/', element: <App />, children: [{ index: true, element: <StatusPage /> }] },
    ])

    render(<RouterProvider router={router} />)

    expect(screen.getByText('Worldbinder')).toBeInTheDocument()
    expect(await screen.findByText(/Connected/)).toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
