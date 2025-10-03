import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnalysisPanel from './AnalysisPanel'
import { renderWithProviders, mockFetch } from '@/test-utils'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

// Mock the useAnalysis hook
vi.mock('@/hooks/useAnalysis', () => ({
  useAnalysis: () => ({
    analyzeCode: vi.fn(),
    analysisResult: null,
    isLoading: false
  })
}))

// Mock the AppContext hook
vi.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
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
  })
}))

describe('AnalysisPanel', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch({ reports: [], analysis: null })
  })

  const mockRepository = {
    id: 'test-repo-123',
    name: 'test-repo',
    url: 'https://github.com/test/repo.git',
    provider: 'github',
    status: 'completed',
    clonedAt: new Date().toISOString()
  }

  it('renders analysis panel', () => {
    renderWithProviders(<AnalysisPanel />)
    
    expect(screen.getByText('AI Code Analysis')).toBeInTheDocument()
  })

  it('shows analyze code button', () => {
    renderWithProviders(<AnalysisPanel />)
    
    expect(screen.getByTestId('button-analyze-code')).toBeInTheDocument()
  })

  it('button is disabled when no repository selected', () => {
    renderWithProviders(<AnalysisPanel />)
    
    const analyzeButton = screen.getByTestId('button-analyze-code')
    expect(analyzeButton).toBeDisabled()
  })

  it('shows repository selection requirement', () => {
    renderWithProviders(<AnalysisPanel />)
    
    // When no repository is selected, button should be disabled
    const analyzeButton = screen.getByTestId('button-analyze-code')
    expect(analyzeButton).toBeDisabled()
  })

  it('displays analysis controls correctly', () => {
    renderWithProviders(<AnalysisPanel />)
    
    // Should show analysis type selector
    expect(screen.getByTestId('select-analysis-type')).toBeInTheDocument()
    
    // Should show depth level selector  
    expect(screen.getByText('Depth Level')).toBeInTheDocument()
    
    // Should show analyze button
    expect(screen.getByTestId('button-analyze-code')).toBeInTheDocument()
  })

  it('renders analysis options correctly', () => {
    renderWithProviders(<AnalysisPanel />)
    
    // Should have analysis type options
    expect(screen.getByText('Analysis Type')).toBeInTheDocument()
    expect(screen.getByText('Depth Level')).toBeInTheDocument()
  })

  it('shows analysis type selector', () => {
    renderWithProviders(<AnalysisPanel />)
    
    expect(screen.getByTestId('select-analysis-type')).toBeInTheDocument()
  })

  it('shows depth level selector', () => {
    renderWithProviders(<AnalysisPanel />)
    
    expect(screen.getByText('Depth Level')).toBeInTheDocument()
  })
})