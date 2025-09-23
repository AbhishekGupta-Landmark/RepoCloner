import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { AppProvider } from '@/context/AppContext'

// Create a custom render function that includes providers
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { 
      retry: false,
      staleTime: 0,
      gcTime: 0
    },
    mutations: { 
      retry: false
    }
  }
})

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  contextOverrides?: {
    currentRepository?: any
    user?: any
    isAuthenticated?: boolean
  }
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createQueryClient(),
    contextOverrides,
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {contextOverrides ? (
          <TestAppProvider overrides={contextOverrides}>
            {children}
          </TestAppProvider>
        ) : (
          <AppProvider>
            {children}
          </AppProvider>
        )}
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient
  }
}

// Mock the AppContext module for testing
vi.mock('@/context/AppContext', () => {
  let mockContext = {
    currentRepository: null,
    user: null,
    isAuthenticated: false,
    repositories: [],
    analyses: [],
    reports: [],
    logs: [],
    technologies: [],
    logService: {
      addLog: vi.fn(),
      clearLogs: vi.fn(),
      getLogs: () => []
    },
    setCurrentRepository: vi.fn(),
    addRepository: vi.fn(),
    addAnalysis: vi.fn(),
    addReport: vi.fn(),
    addTechnology: vi.fn()
  }

  return {
    AppProvider: ({ children }: { children: ReactNode }) => children,
    useAppContext: () => mockContext,
    setMockContext: (overrides: any) => {
      mockContext = { ...mockContext, ...overrides }
    }
  }
})

// Test version of AppProvider with context overrides
function TestAppProvider({ children, overrides }: { children: ReactNode, overrides: any }) {
  // Update the mock context with overrides
  const { setMockContext } = require('@/context/AppContext')
  if (overrides) {
    setMockContext(overrides)
  }

  return <div data-testid="test-app-provider">{children}</div>
}

// Mock fetch for consistent API testing
export const mockFetch = (response: any, ok = true) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response))
  })
}

export const mockFetchError = (error: Error) => {
  global.fetch = vi.fn().mockRejectedValue(error)
}

// Re-export everything from RTL
export * from '@testing-library/react'
export { vi }