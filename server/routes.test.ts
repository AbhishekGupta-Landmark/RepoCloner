import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import session from 'express-session'
import { registerRoutes } from './routes'

// Mock external dependencies
vi.mock('./storage', () => ({
  storage: {
    getRepositories: vi.fn(() => []),
    createRepository: vi.fn(),
    getRepository: vi.fn(),
    updateRepository: vi.fn(),
    deleteRepository: vi.fn(),
    createAnalysisReport: vi.fn(),
    getAnalysisReports: vi.fn()
  }
}))

vi.mock('./services/gitProviders', () => ({
  gitProviders: {
    github: {
      authenticate: vi.fn(),
      cloneRepository: vi.fn(),
      validateUrl: vi.fn(() => true)
    },
    gitlab: {
      authenticate: vi.fn(),
      cloneRepository: vi.fn(),
      validateUrl: vi.fn(() => true)
    }
  },
  detectProvider: vi.fn(() => 'github')
}))

vi.mock('./services/openaiService', () => ({
  openaiService: {
    analyzeRepository: vi.fn(() => Promise.resolve({
      summary: { qualityScore: 85, securityScore: 90, maintainabilityScore: 80 },
      issues: [],
      recommendations: [],
      metrics: { linesOfCode: 1000, complexity: 5, testCoverage: 75, dependencies: 10 },
      technologies: []
    }))
  }
}))

vi.mock('./services/enhancedTechnologyDetection', () => ({
  enhancedTechnologyDetectionService: {
    detectTechnologies: vi.fn(() => Promise.resolve([]))
  }
}))

describe('Routes', () => {
  let app: express.Application

  beforeEach(async () => {
    vi.clearAllMocks()
    
    app = express()
    app.use(express.json())
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }))
    
    await registerRoutes(app)
  })

  describe('Authentication Routes', () => {
    it('GET /api/auth/status returns unauthenticated by default', async () => {
      const response = await request(app)
        .get('/api/auth/status')
        .expect(200)

      expect(response.body).toEqual({ authenticated: false })
    })

    it('POST /api/auth/authenticate handles PAT authentication', async () => {
      const credentials = {
        provider: 'github',
        credentials: {
          token: 'test-token'
        }
      }

      vi.mocked(require('./services/gitProviders').gitProviders.github.authenticate)
        .mockResolvedValue({ success: true, username: 'testuser' })

      const response = await request(app)
        .post('/api/auth/authenticate')
        .send(credentials)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.username).toBe('testuser')
    })

    it('POST /api/auth/authenticate handles authentication failure', async () => {
      const credentials = {
        provider: 'github',
        credentials: {
          token: 'invalid-token'
        }
      }

      vi.mocked(require('./services/gitProviders').gitProviders.github.authenticate)
        .mockResolvedValue({ success: false, error: 'Invalid token' })

      const response = await request(app)
        .post('/api/auth/authenticate')
        .send(credentials)
        .expect(401)

      expect(response.body.error).toBe('Invalid token')
    })

    it('GET /api/auth/:provider/start redirects to OAuth URL', async () => {
      const response = await request(app)
        .get('/api/auth/github/start')
        .expect(302)

      expect(response.headers.location).toContain('github.com/login/oauth/authorize')
    })

    it('GET /api/auth/callback/:provider handles OAuth callback', async () => {
      // Mock the token exchange
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-token', token_type: 'bearer' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            id: 12345, 
            login: 'testuser', 
            name: 'Test User', 
            email: 'test@example.com' 
          })
        })

      const agent = request.agent(app)
      
      // First, get state from start endpoint
      await agent.get('/api/auth/github/start')
      
      // Then simulate callback
      const response = await agent
        .get('/api/auth/callback/github')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302)

      expect(response.headers.location).toContain('auth=success')
    })
  })

  describe('Repository Routes', () => {
    it('GET /api/repositories returns empty array initially', async () => {
      const response = await request(app)
        .get('/api/repositories')
        .expect(200)

      expect(response.body).toEqual([])
    })

    it('POST /api/repositories/clone clones a repository', async () => {
      const repoData = {
        url: 'https://github.com/test/repo',
        provider: 'github'
      }

      vi.mocked(require('./services/gitProviders').gitProviders.github.cloneRepository)
        .mockResolvedValue({
          success: true,
          path: '/tmp/test-repo',
          repositoryInfo: {
            name: 'test-repo',
            description: 'Test repository',
            defaultBranch: 'main'
          }
        })

      vi.mocked(require('./storage').storage.createRepository)
        .mockResolvedValue({
          id: 'repo-123',
          url: repoData.url,
          name: 'test-repo',
          provider: 'github',
          status: 'completed',
          clonedAt: new Date(),
          path: '/tmp/test-repo'
        })

      const response = await request(app)
        .post('/api/repositories/clone')
        .send(repoData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.repository.name).toBe('test-repo')
    })

    it('POST /api/repositories/clone handles clone failure', async () => {
      const repoData = {
        url: 'https://github.com/invalid/repo',
        provider: 'github'
      }

      vi.mocked(require('./services/gitProviders').gitProviders.github.cloneRepository)
        .mockResolvedValue({
          success: false,
          error: 'Repository not found'
        })

      const response = await request(app)
        .post('/api/repositories/clone')
        .send(repoData)
        .expect(400)

      expect(response.body.error).toBe('Repository not found')
    })
  })

  describe('Technology Routes', () => {
    it('GET /api/technologies returns empty array initially', async () => {
      const response = await request(app)
        .get('/api/technologies')
        .expect(200)

      expect(response.body).toEqual([])
    })
  })

  describe('Analysis Routes', () => {
    it('POST /api/repositories/:id/analyze starts analysis', async () => {
      const repositoryId = 'repo-123'

      vi.mocked(require('./storage').storage.getRepository)
        .mockResolvedValue({
          id: repositoryId,
          url: 'https://github.com/test/repo',
          name: 'test-repo',
          provider: 'github',
          status: 'completed',
          clonedAt: new Date(),
          path: '/tmp/test-repo'
        })

      vi.mocked(require('./storage').storage.createAnalysisReport)
        .mockResolvedValue({
          id: 'analysis-123',
          repositoryId,
          status: 'completed',
          createdAt: new Date(),
          completedAt: new Date(),
          result: {
            summary: { qualityScore: 85, securityScore: 90, maintainabilityScore: 80 },
            issues: [],
            recommendations: [],
            metrics: { linesOfCode: 1000, complexity: 5, testCoverage: 75, dependencies: 10 },
            technologies: []
          }
        })

      const response = await request(app)
        .post(`/api/repositories/${repositoryId}/analyze`)
        .send({ repositoryId })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.analysis.status).toBe('completed')
    })
  })

  describe('Admin Routes', () => {
    it('GET /api/admin/oauth-config returns OAuth configuration', async () => {
      const response = await request(app)
        .get('/api/admin/oauth-config')
        .expect(200)

      expect(response.body).toHaveProperty('github')
      expect(response.body).toHaveProperty('gitlab')
      expect(response.body.github).toHaveProperty('enabled')
      expect(response.body.github).toHaveProperty('configured')
    })

    it('POST /api/admin/oauth-config updates OAuth configuration', async () => {
      const config = {
        github: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          scope: 'user:email public_repo',
          enabled: true
        }
      }

      const response = await request(app)
        .post('/api/admin/oauth-config')
        .send(config)
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('handles 404 for unknown routes', async () => {
      await request(app)
        .get('/api/unknown')
        .expect(404)
    })

    it('handles validation errors', async () => {
      const response = await request(app)
        .post('/api/repositories/clone')
        .send({}) // Missing required fields
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('handles server errors gracefully', async () => {
      vi.mocked(require('./storage').storage.getRepositories)
        .mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/repositories')
        .expect(500)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('Multi-Account Support', () => {
    it('GET /api/auth/accounts returns user accounts', async () => {
      const response = await request(app)
        .get('/api/auth/accounts')
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
    })

    it('POST /api/auth/switch-account switches active account', async () => {
      const response = await request(app)
        .post('/api/auth/switch-account')
        .send({ accountId: 'account-123' })
        .expect(200)

      expect(response.body).toHaveProperty('success')
    })

    it('POST /api/auth/logout supports account-specific logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ accountId: 'account-123' })
        .expect(200)

      expect(response.body).toHaveProperty('success')
    })
  })
})