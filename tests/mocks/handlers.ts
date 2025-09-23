import { http, HttpResponse } from 'msw'

export const handlers = [
  // Auth endpoints
  http.get('/api/auth/status', () => {
    return HttpResponse.json({ authenticated: false })
  }),

  http.get('/api/auth/accounts', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/auth/authenticate', () => {
    return HttpResponse.json({ success: true, username: 'testuser', provider: 'github' })
  }),

  // OAuth endpoints
  http.get('/api/auth/github/start', () => {
    return new HttpResponse(null, { status: 302, headers: { Location: 'https://github.com/login/oauth/authorize' } })
  }),

  http.get('/api/auth/callback/github', () => {
    return new HttpResponse(null, { status: 302, headers: { Location: '/?auth=success' } })
  }),

  // Repository endpoints
  http.get('/api/repositories', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/repositories/clone', () => {
    return HttpResponse.json({
      id: 'test-repo-id',
      url: 'https://github.com/test/repo',
      name: 'test-repo',
      provider: 'github',
      status: 'completed'
    })
  }),

  // Technology endpoints
  http.get('/api/technologies', () => {
    return HttpResponse.json([])
  }),

  // Analysis endpoints
  http.post('/api/repositories/:id/analyze', () => {
    return HttpResponse.json({
      id: 'test-analysis-id',
      repositoryId: 'test-repo-id',
      status: 'completed',
      result: {
        summary: { qualityScore: 85, securityScore: 90, maintainabilityScore: 80 },
        issues: [],
        recommendations: [],
        metrics: { linesOfCode: 1000, complexity: 5, testCoverage: 75, dependencies: 10 },
        technologies: []
      }
    })
  }),

  // Admin endpoints
  http.get('/api/admin/oauth-config', () => {
    return HttpResponse.json({
      github: { enabled: true, configured: true },
      gitlab: { enabled: true, configured: false },
      azure: { enabled: false, configured: false },
      bitbucket: { enabled: false, configured: false },
      gitea: { enabled: false, configured: false },
      codeberg: { enabled: false, configured: false },
      sourcehut: { enabled: false, configured: false }
    })
  }),

  // External API mocks
  http.get('https://api.github.com/user', () => {
    return HttpResponse.json({
      id: 12345,
      login: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://github.com/images/error/octocat_happy.gif'
    })
  }),

  http.post('https://github.com/login/oauth/access_token', () => {
    return HttpResponse.json({
      access_token: 'test-access-token',
      token_type: 'bearer',
      scope: 'user:email public_repo'
    })
  }),

  // OpenAI API mock
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: { qualityScore: 85, securityScore: 90, maintainabilityScore: 80 },
            issues: [],
            recommendations: ['Mock recommendation'],
            metrics: { linesOfCode: 1000, complexity: 5, testCoverage: 75, dependencies: 10 },
            technologies: []
          })
        }
      }]
    })
  })
]