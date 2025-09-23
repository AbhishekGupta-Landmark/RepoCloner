import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './useAuth'

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

// Mock the apiRequest function
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn()
}))

// Mock React Query properly
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(() => ({
      mutateAsync: vi.fn(),
      isPending: false
    })),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn()
    }))
  }
})

describe('useAuth', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Mock useQuery with default return values
    const { useQuery } = vi.mocked(await import('@tanstack/react-query'))
    useQuery.mockReturnValue({
      data: { authenticated: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isError: false,
      isSuccess: true
    })
  })

  it('returns initial state correctly', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    })

    // Should have the hook properties  
    expect(result.current.user).toBe(null)
    expect(Array.isArray(result.current.accounts)).toBe(true)
    
    // Should have the hook methods
    expect(typeof result.current.authenticate).toBe('function')
    expect(typeof result.current.signOut).toBe('function')
    expect(typeof result.current.switchAccount).toBe('function')
  })

  it('handles authentication status', async () => {
    const { useQuery } = vi.mocked(await import('@tanstack/react-query'))
    
    // Mock authenticated response for auth status query
    useQuery.mockImplementation((options: any) => {
      if (options.queryKey[0] === '/api/auth/status') {
        return {
          data: { authenticated: true, username: 'testuser', provider: 'github' },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
          isError: false,
          isSuccess: true
        }
      }
      // Default for accounts query
      return {
        data: { accounts: [], activeAccountId: null },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isError: false,
        isSuccess: true
      }
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.user?.username).toBe('testuser')
      expect(result.current.user?.provider).toBe('github')
    })
  })

  it('handles multi-account state', async () => {
    const { useQuery } = vi.mocked(await import('@tanstack/react-query'))
    
    // Mock both queries with proper data
    useQuery.mockImplementation((options: any) => {
      if (options.queryKey[0] === '/api/auth/status') {
        return {
          data: { authenticated: true, username: 'testuser', provider: 'github' },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
          isError: false,
          isSuccess: true
        }
      }
      if (options.queryKey[0] === '/api/auth/accounts') {
        return {
          data: { 
            accounts: [
              { id: 'account-1', provider: 'github', username: 'user1' },
              { id: 'account-2', provider: 'gitlab', username: 'user2' }
            ], 
            activeAccountId: 'account-1' 
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
          isError: false,
          isSuccess: true
        }
      }
      return {
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isError: false,
        isSuccess: true
      }
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.accounts).toHaveLength(2)
      expect(result.current.activeAccountId).toBe('account-1')
    })
  })

  it('provides authentication methods', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    })

    expect(typeof result.current.authenticate).toBe('function')
    expect(typeof result.current.signOut).toBe('function')
    expect(typeof result.current.switchAccount).toBe('function')
  })
})