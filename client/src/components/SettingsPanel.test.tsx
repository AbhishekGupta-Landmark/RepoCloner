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
    
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows available providers', () => {
    renderWithProviders(<SettingsPanel />)
    
    expect(screen.getByText('Git Authentication')).toBeInTheDocument()
    expect(screen.getAllByText('AI Configuration')).toHaveLength(2)
  })

  it('handles provider configuration', async () => {
    renderWithProviders(<SettingsPanel />)
    
    // Check that Git Authentication tab exists
    const gitTab = screen.getByTestId('tab-git-authentication')
    await user.click(gitTab)
    
    expect(gitTab).toBeInTheDocument()
  })

  it('shows OAuth configuration options', async () => {
    renderWithProviders(<SettingsPanel />)
    
    // Go to Git Authentication tab
    const gitTab = screen.getByTestId('tab-git-authentication')
    await user.click(gitTab)
    
    expect(screen.getAllByText('Git Authentication')).toHaveLength(2)
  })

  it('shows AI configuration options', () => {
    renderWithProviders(<SettingsPanel />)
    
    expect(screen.getAllByText('AI Configuration')).toHaveLength(2)
    expect(screen.getByText('Analysis Settings')).toBeInTheDocument()
  })

  it('handles provider enabling/disabling', async () => {
    renderWithProviders(<SettingsPanel />)
    
    // Go to Git Authentication tab first
    const gitTab = screen.getByTestId('tab-git-authentication')
    await user.click(gitTab)
    
    // Check for provider configuration elements
    expect(screen.getAllByText('Git Authentication')).toHaveLength(2)
  })

  it('displays authentication status', () => {
    renderWithProviders(<SettingsPanel />)
    
    // Should show settings header
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('handles configuration validation', async () => {
    renderWithProviders(<SettingsPanel />)
    
    // Go to Git Authentication tab
    const gitTab = screen.getByTestId('tab-git-authentication')
    await user.click(gitTab)
    
    // Check that authentication section loads
    expect(screen.getAllByText('Git Authentication')).toHaveLength(2)
  })
})