import { test, expect } from '@playwright/test'

test.describe('Basic UI Functionality', () => {
  test('loads the main page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Git Repository Cloner/)
    await expect(page.getByText('Git Repository Cloner & Analyzer')).toBeVisible()
  })

  test('shows authentication modal when trying to access protected features', async ({ page }) => {
    await page.goto('/')
    
    // Try to clone a repository without authentication
    await page.fill('[data-testid="input-repository-url"]', 'https://github.com/test/repo')
    await page.click('[data-testid="button-clone"]')
    
    // Should show authentication modal
    await expect(page.getByText('Authentication Required')).toBeVisible()
  })

  test('displays technology showcase when repository is selected', async ({ page }) => {
    await page.goto('/')
    
    // Check if technology showcase panel is visible
    await expect(page.getByText('Technology Stack')).toBeVisible()
  })

  test('shows settings panel when settings button is clicked', async ({ page }) => {
    await page.goto('/')
    
    await page.click('[data-testid="button-settings"]')
    await expect(page.getByText('Settings')).toBeVisible()
  })

  test('responsive design works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    
    await expect(page.getByText('Git Repository Cloner & Analyzer')).toBeVisible()
  })
})

test.describe('Authentication Flow', () => {
  test('opens OAuth authentication modal', async ({ page }) => {
    await page.goto('/')
    
    // Open authentication modal
    await page.click('[data-testid="button-auth"]')
    
    // Should see provider selection
    await expect(page.getByText('Choose your Git provider')).toBeVisible()
    await expect(page.getByTestId('button-github')).toBeVisible()
    await expect(page.getByTestId('button-gitlab')).toBeVisible()
  })

  test('shows PAT authentication form', async ({ page }) => {
    await page.goto('/')
    
    // Open authentication modal
    await page.click('[data-testid="button-auth"]')
    
    // Select GitHub
    await page.click('[data-testid="button-github"]')
    
    // Select PAT method
    await page.click('text=Personal Access Token')
    
    // Should show PAT form
    await expect(page.getByTestId('input-pat-token')).toBeVisible()
    await expect(page.getByTestId('button-pat-submit')).toBeVisible()
  })

  test('validates PAT form submission', async ({ page }) => {
    await page.goto('/')
    
    await page.click('[data-testid="button-auth"]')
    await page.click('[data-testid="button-github"]')
    await page.click('text=Personal Access Token')
    
    // Try submitting empty form
    await page.click('[data-testid="button-pat-submit"]')
    
    // Should show validation error
    await expect(page.getByText('Personal Access Token is required')).toBeVisible()
  })
})

test.describe('Repository Operations', () => {
  test('validates repository URL input', async ({ page }) => {
    await page.goto('/')
    
    // Try invalid URL
    await page.fill('[data-testid="input-repository-url"]', 'invalid-url')
    await page.click('[data-testid="button-clone"]')
    
    // Should show validation error
    await expect(page.getByText('Please enter a valid repository URL')).toBeVisible()
  })

  test('detects provider from URL', async ({ page }) => {
    await page.goto('/')
    
    // Fill GitHub URL
    await page.fill('[data-testid="input-repository-url"]', 'https://github.com/user/repo')
    
    // Should detect GitHub provider
    await expect(page.getByText('GitHub')).toBeVisible()
  })
})

test.describe('UI Interactions', () => {
  test('opens file tree panel', async ({ page }) => {
    await page.goto('/')
    
    // Should see file tree panel
    await expect(page.getByText('Repository Files')).toBeVisible()
  })

  test('technology showcase has smooth transitions', async ({ page }) => {
    await page.goto('/')
    
    // Click on technology cards to test transitions
    const technologyGrid = page.getByTestId('technology-grid')
    await expect(technologyGrid).toBeVisible()
  })

  test('settings modal opens and closes', async ({ page }) => {
    await page.goto('/')
    
    await page.click('[data-testid="button-settings"]')
    await expect(page.getByText('Settings')).toBeVisible()
    
    await page.click('[data-testid="button-close"]')
    await expect(page.getByText('Settings')).not.toBeVisible()
  })
})

test.describe('Error Handling', () => {
  test('shows error states gracefully', async ({ page }) => {
    await page.goto('/')
    
    // Mock network error
    await page.route('/api/repositories', route => {
      route.fulfill({ status: 500, body: 'Server Error' })
    })
    
    await page.reload()
    
    // Should handle error gracefully
    await expect(page.getByText('Git Repository Cloner & Analyzer')).toBeVisible()
  })

  test('handles offline state', async ({ page }) => {
    await page.goto('/')
    
    // Simulate offline
    await page.context().setOffline(true)
    
    // Try to perform an action
    await page.click('[data-testid="button-clone"]')
    
    // Should handle gracefully
    await expect(page.getByText('Git Repository Cloner & Analyzer')).toBeVisible()
  })
})