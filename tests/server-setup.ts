import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { server } from './mocks/server-handlers'

// Setup MSW for Node environment
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Mock environment variables for testing
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = 'test-secret'
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.GITHUB_CLIENT_ID = 'test-github-client-id'
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret'
process.env.GITLAB_CLIENT_ID = 'test-gitlab-client-id'
process.env.GITLAB_CLIENT_SECRET = 'test-gitlab-client-secret'

// Mock file system operations
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      mkdir: vi.fn(),
      rmdir: vi.fn()
    }
  }
})

// Mock child_process for git operations
vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn()
}))