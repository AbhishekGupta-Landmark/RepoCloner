import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import FileTreePanel from './FileTreePanel'

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

// Mock the app context
vi.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
    currentRepository: {
      id: 'test-repo',
      name: 'test-repo', 
      url: 'https://github.com/test/repo'
    }
  })
}))

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('FileTreePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch for API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    })
  })

  it('renders file structure header', () => {
    renderWithQueryClient(<FileTreePanel />)
    expect(screen.getByText('File Structure')).toBeInTheDocument()
  })

  it('shows expand all button', () => {
    renderWithQueryClient(<FileTreePanel />)
    expect(screen.getByTestId('button-expand-all')).toBeInTheDocument()
  })

  it('shows collapse all button', () => {
    renderWithQueryClient(<FileTreePanel />)
    expect(screen.getByTestId('button-collapse-all')).toBeInTheDocument()
  })

  it('shows download repository button', () => {
    renderWithQueryClient(<FileTreePanel />)
    expect(screen.getByTestId('button-download-repository')).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    expect(() => renderWithQueryClient(<FileTreePanel />)).not.toThrow()
  })
})