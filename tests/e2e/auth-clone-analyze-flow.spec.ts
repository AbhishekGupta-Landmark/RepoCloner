import { test, expect, Page } from '@playwright/test'

test.describe('Complete User Journey: Auth → Clone → Analyze → Reports', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage, baseURL }) => {
    page = testPage
    await page.goto(baseURL || 'http://localhost:5000')
  })

  test('end-to-end workflow: authenticate, clone repository, analyze code, and generate reports', async () => {
    // Step 1: Authentication Flow
    await test.step('User authenticates with GitHub PAT', async () => {
      // Open authentication modal
      await page.getByTestId('button-authenticate').click()
      
      // Switch to PAT authentication
      await page.getByTestId('tab-pat-auth').click()
      
      // Select GitHub provider
      await page.getByTestId('button-github-provider').click()
      
      // Fill PAT credentials
      await page.getByTestId('input-pat-token').fill('ghp_test_token_123')
      await page.getByTestId('input-username').fill('testuser')
      
      // Submit authentication
      await page.getByTestId('button-submit-pat').click()
      
      // Verify authentication success
      await expect(page.getByTestId('text-authenticated-user')).toBeVisible()
      await expect(page.getByText('testuser')).toBeVisible()
    })

    // Step 2: Repository Cloning Flow
    await test.step('User clones a repository', async () => {
      // Enter repository URL
      await page.getByTestId('input-repo-url').fill('https://github.com/facebook/react.git')
      
      // Configure clone options
      await page.getByTestId('checkbox-mirror').check()
      
      // Initiate clone
      await page.getByTestId('button-clone-repository').click()
      
      // Wait for cloning to complete
      await expect(page.getByTestId('status-clone-success')).toBeVisible({ timeout: 10000 })
      
      // Verify file tree is populated
      await expect(page.getByTestId('file-tree-container')).toBeVisible()
      await expect(page.getByText('package.json')).toBeVisible()
    })

    // Step 3: Code Analysis Flow
    await test.step('User runs AI code analysis', async () => {
      // Open analysis panel
      await page.getByTestId('button-analyze-code').click()
      
      // Select analysis type
      await page.getByTestId('select-analysis-type').click()
      await page.getByRole('option', { name: 'Security Vulnerability Scan' }).click()
      
      // Configure analysis depth
      await page.getByTestId('select-analysis-depth').click()
      await page.getByRole('option', { name: 'Detailed' }).click()
      
      // Start analysis
      await page.getByTestId('button-analyze-code').click()
      
      // Wait for analysis to complete
      await expect(page.getByTestId('analysis-loading-indicator')).toBeVisible()
      await expect(page.getByTestId('analysis-results-container')).toBeVisible({ timeout: 30000 })
      
      // Verify analysis results
      await expect(page.getByTestId('analysis-issues-count')).toBeVisible()
      await expect(page.getByTestId('analysis-metrics-display')).toBeVisible()
    })

    // Step 4: Reports Generation and Download
    await test.step('User generates and downloads reports', async () => {
      // Navigate to reports panel
      await page.getByTestId('tab-reports').click()
      
      // Verify report is automatically generated
      await expect(page.getByTestId('report-card-0')).toBeVisible()
      
      // Download report
      const downloadPromise = page.waitForDownload()
      await page.getByTestId('button-download-report-0').click()
      const download = await downloadPromise
      
      // Verify download
      expect(download.suggestedFilename()).toMatch(/react.*report\.(pdf|html)/)
      
      // Share reports functionality
      await page.getByTestId('button-share-reports').click()
      await expect(page.getByTestId('share-dialog')).toBeVisible()
    })

    // Step 5: Activity Logs Verification
    await test.step('Verify activity logs captured entire workflow', async () => {
      // Open logs panel
      await page.getByTestId('tab-logs').click()
      
      // Verify key workflow events are logged
      await expect(page.getByText('Authentication completed successfully')).toBeVisible()
      await expect(page.getByText('Repository cloned successfully')).toBeVisible()
      await expect(page.getByText('Code analysis completed')).toBeVisible()
      await expect(page.getByText('Report generated successfully')).toBeVisible()
      
      // Test log filtering
      await page.getByTestId('select-log-level').click()
      await page.getByRole('option', { name: 'INFO' }).click()
      
      // Verify filtered logs
      await expect(page.getByTestId('log-entry-0')).toBeVisible()
    })
  })

  test('error handling: invalid repository URL', async () => {
    await test.step('User tries to clone invalid repository', async () => {
      // Enter invalid URL
      await page.getByTestId('input-repo-url').fill('https://github.com/nonexistent/repository.git')
      
      // Attempt clone
      await page.getByTestId('button-clone-repository').click()
      
      // Verify error handling
      await expect(page.getByTestId('error-message')).toBeVisible()
      await expect(page.getByText('Repository not found')).toBeVisible()
      
      // Verify error is logged
      await page.getByTestId('tab-logs').click()
      await expect(page.getByText('Clone request failed')).toBeVisible()
    })
  })

  test('error handling: analysis without repository', async () => {
    await test.step('User tries to analyze without cloning repository', async () => {
      // Try to start analysis without repository
      const analyzeButton = page.getByTestId('button-analyze-code')
      await expect(analyzeButton).toBeDisabled()
      
      // Verify appropriate messaging
      await expect(page.getByText('No Repository Selected')).toBeVisible()
    })
  })

  test('multi-provider authentication flow', async () => {
    await test.step('User can switch between different Git providers', async () => {
      // Open auth modal
      await page.getByTestId('button-authenticate').click()
      
      // Test GitHub
      await page.getByTestId('button-github-provider').click()
      await expect(page.getByText('GitHub')).toBeVisible()
      
      // Switch to GitLab
      await page.getByTestId('button-gitlab-provider').click()
      await expect(page.getByText('GitLab')).toBeVisible()
      
      // Switch to OAuth method
      await page.getByTestId('tab-oauth-auth').click()
      await expect(page.getByTestId('button-oauth-login')).toBeVisible()
    })
  })

  test('responsive UI and auto-refresh functionality', async () => {
    await test.step('UI responds to different viewport sizes', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await expect(page.getByTestId('mobile-navigation')).toBeVisible()
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })
      await expect(page.getByTestId('tablet-layout')).toBeVisible()
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1200, height: 800 })
      await expect(page.getByTestId('desktop-layout')).toBeVisible()
    })

    await test.step('Auto-refresh functionality works', async () => {
      // Enable auto-refresh
      await page.getByTestId('tab-logs').click()
      await page.getByTestId('switch-auto-refresh').check()
      
      // Verify real-time updates
      await expect(page.getByTestId('icon-connected')).toBeVisible()
      await expect(page.getByTestId('text-connection-status')).toContainText('Real-time')
    })
  })

  test('technology detection and showcase', async () => {
    await test.step('System detects and displays technologies', async () => {
      // Clone a multi-tech repository
      await page.getByTestId('input-repo-url').fill('https://github.com/vercel/next.js.git')
      await page.getByTestId('button-clone-repository').click()
      
      // Wait for file analysis
      await expect(page.getByTestId('file-tree-container')).toBeVisible({ timeout: 10000 })
      
      // Verify technology detection
      await expect(page.getByTestId('technology-badge-javascript')).toBeVisible()
      await expect(page.getByTestId('technology-badge-react')).toBeVisible()
      await expect(page.getByTestId('technology-badge-nodejs')).toBeVisible()
      
      // Test technology showcase interaction
      await page.getByTestId('technology-badge-javascript').click()
      await expect(page.getByTestId('technology-details')).toBeVisible()
    })
  })
})