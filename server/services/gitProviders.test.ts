import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gitProviders, detectProvider } from './gitProviders'
import * as fs from 'fs'
import { execFile } from 'child_process'

// Mock file system operations
vi.mock('fs')
vi.mock('child_process')

describe('GitProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GitHub Provider', () => {
    it('validates GitHub URLs correctly', () => {
      expect(gitProviders.github.validateUrl('https://github.com/user/repo')).toBe(true)
      expect(gitProviders.github.validateUrl('https://github.com/user/repo.git')).toBe(true)
      expect(gitProviders.github.validateUrl('https://gitlab.com/user/repo')).toBe(false)
      expect(gitProviders.github.validateUrl('invalid-url')).toBe(false)
    })

    it('authenticates with valid PAT', async () => {
      // Mock successful fetch response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ login: 'testuser', id: 12345 })
      })

      const result = await gitProviders.github.authenticate({
        token: 'valid-token'
      })

      expect(result.success).toBe(true)
      expect(result.username).toBe('testuser')
    })

    it('handles authentication failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Bad credentials' })
      })

      const result = await gitProviders.github.authenticate({
        token: 'invalid-token'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Bad credentials')
    })

    it('clones repository successfully', async () => {
      // Mock successful git clone
      vi.mocked(execFile).mockImplementation((command, args, options, callback) => {
        if (callback) callback(null, 'Cloning...', '')
        return {} as any
      })

      // Mock file system operations
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        name: 'test-repo',
        description: 'Test repository'
      }))

      const result = await gitProviders.github.cloneRepository(
        'https://github.com/user/repo',
        '/tmp/test-repo',
        { token: 'test-token' }
      )

      expect(result.success).toBe(true)
      expect(result.path).toBe('/tmp/test-repo')
      expect(result.repositoryInfo?.name).toBe('test-repo')
    })

    it('handles clone failure', async () => {
      // Mock failed git clone
      vi.mocked(execFile).mockImplementation((command, args, options, callback) => {
        if (callback) callback(new Error('Repository not found'), '', 'fatal: repository not found')
        return {} as any
      })

      const result = await gitProviders.github.cloneRepository(
        'https://github.com/user/nonexistent',
        '/tmp/test-repo',
        { token: 'test-token' }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Repository not found')
    })

    it('extracts repository info from package.json', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        name: 'test-package',
        description: 'Test package description',
        version: '1.0.0'
      }))

      vi.mocked(execFile).mockImplementation((command, args, options, callback) => {
        if (callback) callback(null, 'Cloning...', '')
        return {} as any
      })

      const result = await gitProviders.github.cloneRepository(
        'https://github.com/user/repo',
        '/tmp/test-repo',
        { token: 'test-token' }
      )

      expect(result.repositoryInfo?.name).toBe('test-package')
      expect(result.repositoryInfo?.description).toBe('Test package description')
    })
  })

  describe('GitLab Provider', () => {
    it('validates GitLab URLs correctly', () => {
      expect(gitProviders.gitlab.validateUrl('https://gitlab.com/user/repo')).toBe(true)
      expect(gitProviders.gitlab.validateUrl('https://gitlab.com/user/repo.git')).toBe(true)
      expect(gitProviders.gitlab.validateUrl('https://github.com/user/repo')).toBe(false)
      expect(gitProviders.gitlab.validateUrl('invalid-url')).toBe(false)
    })

    it('authenticates with valid PAT', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ username: 'testuser', id: 12345 })
      })

      const result = await gitProviders.gitlab.authenticate({
        token: 'valid-token'
      })

      expect(result.success).toBe(true)
      expect(result.username).toBe('testuser')
    })

    it('handles authentication failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' })
      })

      const result = await gitProviders.gitlab.authenticate({
        token: 'invalid-token'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unauthorized')
    })
  })

  describe('Provider Detection', () => {
    it('detects GitHub URLs', () => {
      expect(detectProvider('https://github.com/user/repo')).toBe('github')
      expect(detectProvider('https://github.com/user/repo.git')).toBe('github')
    })

    it('detects GitLab URLs', () => {
      expect(detectProvider('https://gitlab.com/user/repo')).toBe('gitlab')
      expect(detectProvider('https://gitlab.com/user/repo.git')).toBe('gitlab')
    })

    it('detects Azure DevOps URLs', () => {
      expect(detectProvider('https://dev.azure.com/org/project/_git/repo')).toBe('azure')
      expect(detectProvider('https://org.visualstudio.com/project/_git/repo')).toBe('azure')
    })

    it('detects Bitbucket URLs', () => {
      expect(detectProvider('https://bitbucket.org/user/repo')).toBe('bitbucket')
      expect(detectProvider('https://bitbucket.org/user/repo.git')).toBe('bitbucket')
    })

    it('detects Codeberg URLs', () => {
      expect(detectProvider('https://codeberg.org/user/repo')).toBe('codeberg')
      expect(detectProvider('https://codeberg.org/user/repo.git')).toBe('codeberg')
    })

    it('returns null for unknown URLs', () => {
      expect(detectProvider('https://unknown.com/user/repo')).toBeNull()
      expect(detectProvider('invalid-url')).toBeNull()
    })
  })

  describe('URL Validation', () => {
    it('validates GitHub URLs with different formats', () => {
      const validUrls = [
        'https://github.com/user/repo',
        'https://github.com/user/repo.git',
        'https://github.com/org/repo-name',
        'https://github.com/user/repo-with-dashes'
      ]

      validUrls.forEach(url => {
        expect(gitProviders.github.validateUrl(url)).toBe(true)
      })
    })

    it('rejects invalid GitHub URLs', () => {
      const invalidUrls = [
        'https://gitlab.com/user/repo',
        'https://github.com/user', // Missing repo name
        'https://github.com/', // Missing user and repo
        'not-a-url',
        ''
      ]

      invalidUrls.forEach(url => {
        expect(gitProviders.github.validateUrl(url)).toBe(false)
      })
    })
  })

  describe('Error Handling', () => {
    it('handles network errors during authentication', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await gitProviders.github.authenticate({
        token: 'test-token'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })

    it('handles file system errors during cloning', async () => {
      vi.mocked(execFile).mockImplementation((command, args, options, callback) => {
        if (callback) callback(null, 'Cloning...', '')
        return {} as any
      })

      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = await gitProviders.github.cloneRepository(
        'https://github.com/user/repo',
        '/tmp/test-repo',
        { token: 'test-token' }
      )

      expect(result.success).toBe(true) // Should still succeed even without package.json
      expect(result.repositoryInfo?.name).toBe('repo') // Fallback to URL-based name
    })
  })
})