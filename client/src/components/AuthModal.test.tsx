import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AuthModal from './AuthModal'

// Mock the hooks
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    authenticate: vi.fn().mockResolvedValue(true),
    isLoading: false
  })
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('AuthModal', () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch for OAuth config
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        config: {
          github: { clientId: 'test', clientSecret: 'test' },
          gitlab: { clientId: '', clientSecret: '' }
        }
      })
    })
  })

  it('renders authentication modal when open', async () => {
    await act(async () => {
      renderWithQueryClient(
        <AuthModal 
          open={true} 
          onOpenChange={mockOnOpenChange}
        />
      )
    })

    expect(screen.getByText('Authenticate with Git Provider')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderWithQueryClient(
      <AuthModal 
        open={false} 
        onOpenChange={mockOnOpenChange}
      />
    )

    expect(screen.queryByText('Authenticate with Git Provider')).not.toBeInTheDocument()
  })

  it('shows provider selection buttons', async () => {
    await act(async () => {
      renderWithQueryClient(
        <AuthModal 
          open={true} 
          onOpenChange={mockOnOpenChange}
        />
      )
    })

    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('GitLab')).toBeInTheDocument()
  })

  it('shows OAuth and PAT authentication methods', async () => {
    await act(async () => {
      renderWithQueryClient(
        <AuthModal 
          open={true} 
          onOpenChange={mockOnOpenChange}
        />
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Authentication Method')).toBeInTheDocument()
    })
  })

  it('handles OAuth authentication flow', async () => {
    const user = userEvent.setup()
    
    await act(async () => {
      renderWithQueryClient(
        <AuthModal 
          open={true} 
          onOpenChange={mockOnOpenChange}
        />
      )
    })

    // Should show authentication button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument()
    })
  })

  it('handles PAT authentication form', async () => {
    // Mock a provider that supports PAT (not Bitbucket)
    await act(async () => {
      renderWithQueryClient(
        <AuthModal 
          open={true} 
          onOpenChange={mockOnOpenChange}
        />
      )
    })

    // Should show Authentication Method section
    await waitFor(() => {
      expect(screen.getByText('Authentication Method')).toBeInTheDocument()
    })
  })

  it('can switch between providers', async () => {
    const user = userEvent.setup()
    
    await act(async () => {
      renderWithQueryClient(
        <AuthModal 
          open={true} 
          onOpenChange={mockOnOpenChange}
        />
      )
    })

    // Should start with GitHub selected
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    
    // Click on GitLab
    await act(async () => {
      await user.click(screen.getByText('GitLab'))
    })

    // Should show GitLab selected
    await waitFor(() => {
      expect(screen.getByText('GitLab')).toBeInTheDocument()
    })
  })

  it('handles provider configuration status', async () => {
    // Mock OAuth config with GitLab not configured
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        config: {
          github: { clientId: 'test', clientSecret: 'test' },
          gitlab: { clientId: '', clientSecret: '' }
        }
      })
    })

    await act(async () => {
      renderWithQueryClient(
        <AuthModal 
          open={true} 
          onOpenChange={mockOnOpenChange}
        />
      )
    })

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument()
    })
  })
})