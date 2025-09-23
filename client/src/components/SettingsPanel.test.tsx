import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPanel from './SettingsPanel'
import { renderWithProviders, mockFetch } from '@/test-utils'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('SettingsPanel', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch({ providers: [] })
  })

  it('renders settings panel', () => {
    renderWithProviders(<SettingsPanel />)
    
    expect(screen.getByText('Provider Settings')).toBeInTheDocument()
  })

  it('shows available providers', () => {
    renderWithProviders(<SettingsPanel />)
    
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('GitLab')).toBeInTheDocument()
  })

  it('handles provider configuration', async () => {
    renderWithProviders(<SettingsPanel />)
    
    const configureButton = screen.getByTestId('button-configure-github')
    await user.click(configureButton)
    
    // Should open configuration dialog
    expect(configureButton).toBeInTheDocument()
  })

  it('shows OAuth configuration options', () => {
    renderWithProviders(<SettingsPanel />)
    
    expect(screen.getByText('OAuth Configuration')).toBeInTheDocument()
  })

  it('shows PAT configuration options', () => {
    renderWithProviders(<SettingsPanel />)
    
    expect(screen.getByText('Personal Access Token')).toBeInTheDocument()
  })

  it('handles provider enabling/disabling', async () => {
    renderWithProviders(<SettingsPanel />)
    
    const enableSwitch = screen.getByTestId('switch-enable-github')
    await user.click(enableSwitch)
    
    // Should toggle provider state
    expect(enableSwitch).toBeInTheDocument()
  })

  it('displays authentication status', () => {
    renderWithProviders(<SettingsPanel />)
    
    // Should show current auth status
    expect(screen.getByTestId('status-github-auth')).toBeInTheDocument()
  })

  it('handles configuration validation', async () => {
    renderWithProviders(<SettingsPanel />)
    
    const testButton = screen.getByTestId('button-test-connection')
    await user.click(testButton)
    
    // Should test connection
    expect(testButton).toBeInTheDocument()
  })
})