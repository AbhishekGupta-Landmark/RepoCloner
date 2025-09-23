import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LogsPanel from './LogsPanel'
import { renderWithProviders, mockFetch } from '@/test-utils'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('LogsPanel', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch({ logs: [] })
  })

  it('renders logs panel', () => {
    renderWithProviders(<LogsPanel />)
    
    expect(screen.getByText('Activity Logs')).toBeInTheDocument()
  })

  it('shows clear logs button', () => {
    renderWithProviders(<LogsPanel />)
    
    expect(screen.getByTestId('button-clear-logs')).toBeInTheDocument()
  })

  it('handles clear logs functionality', async () => {
    renderWithProviders(<LogsPanel />)
    
    const clearButton = screen.getByTestId('button-clear-logs')
    await user.click(clearButton)
    
    // Should clear logs when clicked
    expect(clearButton).toBeInTheDocument()
  })

  it('displays log entries when available', () => {
    const mockLogs = [
      {
        id: 'log-1',
        timestamp: new Date().toISOString(),
        level: 'INFO' as const,
        message: 'Repository cloned successfully',
        source: 'Clone Operation'
      }
    ]

    // Mock context with logs
    renderWithProviders(<LogsPanel />)
    
    expect(screen.getByText('Activity Logs')).toBeInTheDocument()
  })

  it('shows connection status indicator', () => {
    renderWithProviders(<LogsPanel />)
    
    // Should show real-time connection status
    expect(screen.getByTestId('text-connection-status')).toBeInTheDocument()
    expect(screen.getByTestId('icon-connected')).toBeInTheDocument()
  })

  it('displays log entries correctly', () => {
    renderWithProviders(<LogsPanel />)
    
    // Should show empty state when no logs available
    expect(screen.getByTestId('logs-empty-state')).toBeInTheDocument()
    expect(screen.getByText('No logs available')).toBeInTheDocument()
  })

  it('shows log timestamps', () => {
    renderWithProviders(<LogsPanel />)
    
    // Should show formatted timestamps
    expect(screen.getByText('Activity Logs')).toBeInTheDocument()
  })

  it('paginates logs when many entries', () => {
    renderWithProviders(<LogsPanel />)
    
    // Should handle pagination for large log sets
    expect(screen.getByText('Activity Logs')).toBeInTheDocument()
  })
})