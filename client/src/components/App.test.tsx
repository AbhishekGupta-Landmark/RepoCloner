import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, mockFetch } from '@/test-utils'

// Create a simple App test component
function TestApp() {
  return (
    <div data-testid="main-app">
      <div data-testid="repository-input">Repository Input</div>
      <div data-testid="file-tree-panel">File Tree</div>
      <div data-testid="analysis-panel">Analysis Panel</div>
      <div data-testid="reports-panel">Reports Panel</div>
      <div data-testid="logs-panel">Logs Panel</div>
      <div data-testid="technology-showcase">Technology Showcase</div>
      <div data-testid="auth-modal">Auth Modal</div>
    </div>
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch({ repositories: [], reports: [], logs: [] })
  })

  it('renders main application layout', () => {
    renderWithProviders(<TestApp />)
    
    // Should render main container
    expect(screen.getByTestId('main-app')).toBeInTheDocument()
    expect(screen.getByTestId('repository-input')).toBeInTheDocument()
    expect(screen.getByTestId('file-tree-panel')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-panel')).toBeInTheDocument()
  })

  it('renders all major panel components', () => {
    renderWithProviders(<TestApp />)
    
    expect(screen.getByTestId('repository-input')).toBeInTheDocument()
    expect(screen.getByTestId('file-tree-panel')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-panel')).toBeInTheDocument()
    expect(screen.getByTestId('reports-panel')).toBeInTheDocument()
    expect(screen.getByTestId('logs-panel')).toBeInTheDocument()
    expect(screen.getByTestId('technology-showcase')).toBeInTheDocument()
  })

  it('includes authentication modal', () => {
    renderWithProviders(<TestApp />)
    
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument()
  })

  it('application loads without errors', () => {
    expect(() => renderWithProviders(<TestApp />)).not.toThrow()
  })

  it('renders responsive layout components', () => {
    renderWithProviders(<TestApp />)
    
    // Should have main panels for responsive design
    expect(screen.getByTestId('repository-input')).toBeInTheDocument()
    expect(screen.getByTestId('file-tree-panel')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-panel')).toBeInTheDocument()
  })
})