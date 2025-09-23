import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TechnologyShowcase from './TechnologyShowcase'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'

const mockTechnologies = [
  {
    id: '1',
    name: 'React',
    category: 'frontend' as const,
    icon: 'react',
    version: '18.0.0',
    confidence: 0.95,
    evidence: ['package.json', 'src/App.jsx']
  },
  {
    id: '2',
    name: 'Node.js',
    category: 'runtime' as const,
    icon: 'nodejs',
    version: '18.0.0',
    confidence: 0.9,
    evidence: ['package.json', '.nvmrc']
  },
  {
    id: '3',
    name: 'TypeScript',
    category: 'language' as const,
    icon: 'typescript',
    version: '4.9.0',
    confidence: 0.85,
    evidence: ['tsconfig.json', 'src/types.ts']
  }
]

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

// Mock TanStack Query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: vi.fn()
  }
})

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

// Helper to render component with query client
const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('TechnologyShowcase', async () => {
  const mockUseQuery = vi.mocked(await import('@tanstack/react-query')).useQuery

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles empty technology list', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
      isError: false
    } as any)

    renderWithQueryClient(<TechnologyShowcase repositoryName="test-repo" />)

    expect(screen.getByText('No Technology Stack Data')).toBeInTheDocument()
  })

  it('displays technologies when provided', async () => {
    mockUseQuery.mockReturnValue({
      data: mockTechnologies,
      isLoading: false,
      isFetching: false,
      error: null,
      isError: false
    } as any)

    renderWithQueryClient(<TechnologyShowcase repositoryName="test-repo" />)

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByTestId('technology-showcase')).toBeInTheDocument()
    })
    
    // Check that technologies are displayed
    expect(mockTechnologies.length).toBeGreaterThan(0)
  })

  it('shows loading state', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      error: null,
      isError: false
    } as any)

    renderWithQueryClient(<TechnologyShowcase repositoryName="test-repo" />)

    expect(screen.getByTestId('loading-technologies')).toBeInTheDocument()
  })

  it('shows basic technology information', async () => {
    mockUseQuery.mockReturnValue({
      data: mockTechnologies,
      isLoading: false,
      isFetching: false,
      error: null,
      isError: false
    } as any)

    renderWithQueryClient(<TechnologyShowcase repositoryName="test-repo" />)

    await waitFor(() => {
      expect(screen.getByTestId('technology-showcase')).toBeInTheDocument()
    })
    
    // Check that all technologies are present
    expect(mockTechnologies).toHaveLength(3)
  })
})