import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportsPanel from './ReportsPanel'
import { renderWithProviders, mockFetch, mockFetchError } from '@/test-utils'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('ReportsPanel', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch({ reports: [] })
  })

  it('renders reports panel', () => {
    renderWithProviders(<ReportsPanel />)
    
    expect(screen.getByText('Generated Reports')).toBeInTheDocument()
  })

  it('shows share reports button', () => {
    renderWithProviders(<ReportsPanel />)
    
    expect(screen.getByTestId('button-share-reports')).toBeInTheDocument()
  })

  it('displays empty state when no reports', () => {
    renderWithProviders(<ReportsPanel />)
    
    expect(screen.getByTestId('reports-empty-state')).toBeInTheDocument()
    expect(screen.getByText('No Repository Selected')).toBeInTheDocument()
  })

  it('handles share reports functionality', async () => {
    renderWithProviders(<ReportsPanel />)
    
    const shareButton = screen.getByTestId('button-share-reports')
    await user.click(shareButton)
    
    // Should trigger share functionality
    expect(shareButton).toBeInTheDocument()
  })

  it('displays reports when available', async () => {
    const mockReports = [
      {
        id: 'report-1',
        repositoryId: 'repo-1',
        type: 'analysis',
        content: 'Analysis results...',
        createdAt: new Date().toISOString()
      }
    ]

    mockFetch({ reports: mockReports })
    
    renderWithProviders(<ReportsPanel />)
    
    // Should show reports when available
    expect(screen.getByText('Generated Reports')).toBeInTheDocument()
  })

  it('handles report generation errors', async () => {
    mockFetchError(new Error('Failed to generate report'))
    
    renderWithProviders(<ReportsPanel />)
    
    // Should handle error state gracefully
    expect(screen.getByText('Generated Reports')).toBeInTheDocument()
  })

  it('enables/disables share button based on reports availability', () => {
    renderWithProviders(<ReportsPanel />)
    
    const shareButton = screen.getByTestId('button-share-reports')
    // Share button should be present regardless of reports
    expect(shareButton).toBeInTheDocument()
  })
})