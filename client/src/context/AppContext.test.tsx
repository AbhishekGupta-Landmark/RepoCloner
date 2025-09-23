import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppProvider, useAppContext } from './AppContext'

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('AppContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides context values', () => {
    const TestComponent = () => {
      const context = useAppContext()
      return (
        <div>
          <span data-testid="show-repo-panel">{context.showRepoPanel.toString()}</span>
          <span data-testid="last-expanded-width">{context.lastExpandedWidth}</span>
        </div>
      )
    }

    const queryClient = createQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <TestComponent />
        </AppProvider>
      </QueryClientProvider>
    )

    expect(screen.getByTestId('show-repo-panel')).toBeInTheDocument()
    expect(screen.getByTestId('last-expanded-width')).toBeInTheDocument()
  })

  it('provides context methods', () => {
    const queryClient = createQueryClient()
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <AppProvider>{children}</AppProvider>
        </QueryClientProvider>
      )
    })

    expect(typeof result.current.setCurrentRepository).toBe('function')
    expect(typeof result.current.toggleRepoPanel).toBe('function')
    expect(typeof result.current.setLastExpandedWidth).toBe('function')
    expect(typeof result.current.handleToggleRepoPanel).toBe('function')
  })

  it('has correct initial state', () => {
    const queryClient = createQueryClient()
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <AppProvider>{children}</AppProvider>
        </QueryClientProvider>
      )
    })

    expect(result.current.currentRepository).toBeNull()
    expect(typeof result.current.isRepositoryLoading).toBe('boolean')
    expect(typeof result.current.showRepoPanel).toBe('boolean')
    expect(typeof result.current.lastExpandedWidth).toBe('number')
  })
})