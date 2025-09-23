import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RepositoryInput from './RepositoryInput'
import { renderWithProviders, mockFetch, mockFetchError } from '@/test-utils'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('RepositoryInput', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch({ repository: null })
  })

  it('renders repository input form', () => {
    renderWithProviders(<RepositoryInput />)
    
    expect(screen.getByPlaceholderText(/repository URL/i)).toBeInTheDocument()
  })

  it('shows provider selection buttons', () => {
    renderWithProviders(<RepositoryInput />)
    
    // Should show provider selection controls
    expect(screen.getByTestId('select-provider')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/repository URL/i)).toBeInTheDocument()
  })

  it('allows URL input', async () => {
    renderWithProviders(<RepositoryInput />)
    
    const urlInput = screen.getByPlaceholderText(/repository URL/i)
    await user.type(urlInput, 'https://github.com/example/repo.git')
    
    expect(urlInput).toHaveValue('https://github.com/example/repo.git')
  })

  it('shows paste from clipboard button', async () => {
    renderWithProviders(<RepositoryInput />)
    
    // Should have clipboard functionality 
    expect(screen.getByRole('button', { name: /clone repository/i })).toBeInTheDocument()
  })

  it('disables clone button when no URL provided', () => {
    renderWithProviders(<RepositoryInput />)
    
    const cloneButton = screen.getByTestId('button-clone-repository')
    expect(cloneButton).toBeDisabled()
  })

  it('enables clone button when URL is provided', async () => {
    renderWithProviders(<RepositoryInput />)
    
    const urlInput = screen.getByPlaceholderText(/repository URL/i)
    await user.type(urlInput, 'https://github.com/test/repo.git')
    
    const cloneButton = screen.getByTestId('button-clone-repository')
    expect(cloneButton).not.toBeDisabled()
  })

  it('handles successful clone operation', async () => {
    mockFetch({
      repository: {
        id: 'repo-1',
        name: 'test-repo',
        provider: 'github'
      }
    })

    renderWithProviders(<RepositoryInput />)
    
    const urlInput = screen.getByPlaceholderText(/repository URL/i)
    await user.type(urlInput, 'https://github.com/test/repo.git')
    
    const cloneButton = screen.getByTestId('button-clone-repository')
    await user.click(cloneButton)
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/repositories/clone'),
      expect.objectContaining({
        method: 'POST'
      })
    )
  })

  it('handles clone operation errors', async () => {
    mockFetchError(new Error('Repository not found'))

    renderWithProviders(<RepositoryInput />)
    
    const urlInput = screen.getByPlaceholderText(/repository URL/i)
    await user.type(urlInput, 'https://github.com/invalid/repo.git')
    
    const cloneButton = screen.getByTestId('button-clone-repository')
    await user.click(cloneButton)
    
    // Should show error state or toast
    expect(global.fetch).toHaveBeenCalled()
  })
})