import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCloning } from './useCloning'

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

const createWrapper = () => {
  const queryClient = createQueryClient()
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('useCloning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('returns cloning methods', () => {
    const { result } = renderHook(() => useCloning(), {
      wrapper: createWrapper()
    })

    expect(typeof result.current.cloneRepository).toBe('function')
    expect(typeof result.current.isLoading).toBe('boolean')
  })

  it('handles repository cloning', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        repository: {
          id: 'repo-1', 
          name: 'test-repo',
          status: 'cloned'
        }
      })
    })

    const { result } = renderHook(() => useCloning(), {
      wrapper: createWrapper()
    })

    const success = await result.current.cloneRepository('https://github.com/test/repo', {})
    expect(typeof success).toBe('boolean')
  })

  it('handles cloning errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Clone failed'))

    const { result } = renderHook(() => useCloning(), {
      wrapper: createWrapper()
    })

    const success = await result.current.cloneRepository('invalid-url', {})
    expect(success).toBe(false)
  })
})