import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vite.config.ts sets `test.globals: false`, so testing-library's automatic
// afterEach-based cleanup (which relies on a global `afterEach`) never
// registers on its own — without this, DOM from one test's render() leaks
// into the next test in the same file.
afterEach(cleanup)
