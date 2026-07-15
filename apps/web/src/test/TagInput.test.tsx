import { TagInput } from '@worldbinder/ui'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

function Wrapper() {
  const [tags, setTags] = useState<string[]>(['existing'])
  return <TagInput label="Tags" value={tags} onChange={setTags} />
}

describe('TagInput', () => {
  it('renders chips as a real list', () => {
    render(<Wrapper />)
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('existing')
  })

  it('announces an added tag via the live region — regression test for Milestone 13 Phase 2', () => {
    render(<Wrapper />)
    const input = screen.getByLabelText('Tags')
    fireEvent.change(input, { target: { value: 'new-tag' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('status')).toHaveTextContent('Added tag new-tag')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('announces a removed tag via the live region', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove existing' }))

    expect(screen.getByRole('status')).toHaveTextContent('Removed tag existing')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
