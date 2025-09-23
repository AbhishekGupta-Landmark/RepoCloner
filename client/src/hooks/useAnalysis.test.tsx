import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAnalysis } from './useAnalysis'

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

describe('useAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('returns analysis methods', () => {
    const { result } = renderHook(() => useAnalysis(), {
      wrapper: createWrapper()
    })

    expect(typeof result.current.analyzeCode).toBe('function')
    expect(typeof result.current.generateSummaryReport).toBe('function')
    expect(result.current.analysisResult).toBe(null)
  })

  it('provides expected properties', () => {
    const { result } = renderHook(() => useAnalysis(), {
      wrapper: createWrapper()
    })

    expect(Array.isArray(result.current.reports)).toBe(true)
    expect(typeof result.current.isLoading).toBe('boolean')
    expect(result.current.reports).toEqual([])
  })

  it('initializes with null analysis result', () => {
    const { result } = renderHook(() => useAnalysis(), {
      wrapper: createWrapper()
    })

    expect(result.current.analysisResult).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
})