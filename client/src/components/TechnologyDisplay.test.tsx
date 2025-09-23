import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TechnologyDisplay from './TechnologyDisplay'
import { renderWithProviders, mockFetch } from '@/test-utils'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('TechnologyDisplay', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch({ technologies: [] })
  })

  it('renders technology display', () => {
    renderWithProviders(<TechnologyDisplay />)
    
    expect(screen.getByText('Technologies Detected')).toBeInTheDocument()
  })

  it('shows technology icons and names', () => {
    const mockTechnologies = [
      { name: 'React', category: 'Frontend', confidence: 95 },
      { name: 'Node.js', category: 'Backend', confidence: 90 }
    ]

    renderWithProviders(<TechnologyDisplay technologies={mockTechnologies} />)
    
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Node.js')).toBeInTheDocument()
  })

  it('displays confidence scores', () => {
    const mockTechnologies = [
      { name: 'TypeScript', category: 'Language', confidence: 88 }
    ]

    renderWithProviders(<TechnologyDisplay technologies={mockTechnologies} />)
    
    expect(screen.getByText('88%')).toBeInTheDocument()
  })

  it('groups technologies by category', () => {
    const mockTechnologies = [
      { name: 'React', category: 'Frontend', confidence: 95 },
      { name: 'Express', category: 'Backend', confidence: 85 }
    ]

    renderWithProviders(<TechnologyDisplay technologies={mockTechnologies} />)
    
    expect(screen.getByText('Frontend')).toBeInTheDocument()
    expect(screen.getByText('Backend')).toBeInTheDocument()
  })

  it('handles empty technology list', () => {
    renderWithProviders(<TechnologyDisplay technologies={[]} />)
    
    expect(screen.getByText('No technologies detected')).toBeInTheDocument()
  })

  it('shows technology details on click', async () => {
    const mockTechnologies = [
      { name: 'React', category: 'Frontend', confidence: 95, description: 'JavaScript library' }
    ]

    renderWithProviders(<TechnologyDisplay technologies={mockTechnologies} />)
    
    const techItem = screen.getByText('React')
    await user.click(techItem)
    
    // Should show expanded details
    expect(techItem).toBeInTheDocument()
  })
})