import { Combobox, type ComboboxOption } from '@worldbinder/ui'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

const OPTIONS: ComboboxOption[] = [
  { id: '1', label: 'Alpha' },
  { id: '2', label: 'Beta' },
]

function Wrapper({ onSelect }: { onSelect: (option: ComboboxOption) => void }) {
  const [value, setValue] = useState('')
  return (
    <Combobox
      label="Entity"
      inputValue={value}
      onInputChange={setValue}
      options={OPTIONS}
      onSelect={onSelect}
    />
  )
}

describe('Combobox', () => {
  it('renders as a labeled combobox', () => {
    render(<Wrapper onSelect={() => {}} />)
    expect(screen.getByRole('combobox', { name: 'Entity' })).toBeInTheDocument()
  })

  it('sets aria-activedescendant to the active option as arrow keys move — regression test for Milestone 13 Phase 2', () => {
    render(<Wrapper onSelect={() => {}} />)
    const input = screen.getByRole('combobox', { name: 'Entity' })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'a' } })
    expect(input).toHaveAttribute('aria-activedescendant')
    const firstActiveId = input.getAttribute('aria-activedescendant')
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('id', firstActiveId)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const secondActiveId = input.getAttribute('aria-activedescendant')
    expect(secondActiveId).not.toBe(firstActiveId)
    expect(screen.getByRole('option', { name: 'Beta' })).toHaveAttribute('id', secondActiveId)
  })

  it('selects the active option on Enter', () => {
    const onSelect = vi.fn()
    render(<Wrapper onSelect={onSelect} />)
    const input = screen.getByRole('combobox', { name: 'Entity' })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0])
  })
})
