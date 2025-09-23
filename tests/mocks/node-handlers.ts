import { http, HttpResponse } from 'msw'

export const nodeHandlers = [
  // GitHub API endpoints
  http.get('https://api.github.com/user', () => {
    return HttpResponse.json({
      id: 12345,
      login: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://github.com/images/error/octocat_happy.gif'
    })
  }),

  http.get('https://api.github.com/repos/:owner/:repo', () => {
    return HttpResponse.json({
      id: 123456789,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      private: false,
      clone_url: 'https://github.com/testuser/test-repo.git',
      default_branch: 'main',
      description: 'Test repository'
    })
  }),

  http.post('https://github.com/login/oauth/access_token', () => {
    return HttpResponse.json({
      access_token: 'test-access-token',
      token_type: 'bearer',
      scope: 'user:email public_repo'
    })
  }),

  // GitLab API endpoints
  http.get('https://gitlab.com/api/v4/user', () => {
    return HttpResponse.json({
      id: 12345,
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://gitlab.com/uploads/-/system/user/avatar/12345/avatar.png'
    })
  }),

  http.post('https://gitlab.com/oauth/token', () => {
    return HttpResponse.json({
      access_token: 'test-access-token',
      token_type: 'bearer',
      scope: 'api'
    })
  }),

  // OpenAI API endpoints
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: { qualityScore: 85, securityScore: 90, maintainabilityScore: 80 },
            issues: [
              {
                type: 'warning',
                severity: 'medium',
                description: 'Test issue for mocking',
                file: 'src/test.js',
                line: 10,
                suggestion: 'Fix this test issue'
              }
            ],
            recommendations: [
              'Add more unit tests',
              'Improve error handling',
              'Update dependencies'
            ],
            metrics: { linesOfCode: 1000, complexity: 5, testCoverage: 75, dependencies: 10 },
            technologies: [
              { name: 'React', category: 'frontend', version: '18.0.0', confidence: 0.95 },
              { name: 'Node.js', category: 'runtime', version: '18.0.0', confidence: 0.9 }
            ]
          })
        }
      }]
    })
  })
]