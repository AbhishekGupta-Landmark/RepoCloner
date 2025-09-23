import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MainPage from './MainPage'
import { AppProvider } from '@/context/AppContext'

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        {component}
      </AppProvider>
    </QueryClientProvider>
  )
}

// Mock all the panels
vi.mock('@/components/RepositoryInput', () => ({
  default: () => <div data-testid="repository-input">Repository Input</div>
}))

vi.mock('@/components/FileTreePanel', () => ({
  default: () => <div data-testid="file-tree-panel">File Tree Panel</div>
}))

vi.mock('@/components/AnalysisPanel', () => ({
  default: () => <div data-testid="analysis-panel">Analysis Panel</div>
}))

vi.mock('@/components/ReportsPanel', () => ({
  default: () => <div data-testid="reports-panel">Reports Panel</div>
}))

vi.mock('@/components/SettingsPanel', () => ({
  default: () => <div data-testid="settings-panel">Settings Panel</div>
}))

vi.mock('@/components/LogsPanel', () => ({
  default: () => <div data-testid="logs-panel">Logs Panel</div>
}))

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('MainPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders main page layout', () => {
    renderWithProviders(<MainPage />)

    expect(screen.getByText('Git Repository Cloner & Analyzer')).toBeInTheDocument()
  })

  it('shows repository input panel', () => {
    renderWithProviders(<MainPage />)

    expect(screen.getByTestId('repository-input')).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    expect(() => renderWithProviders(<MainPage />)).not.toThrow()
  })
})