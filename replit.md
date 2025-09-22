# Git Repository Cloner & Analyzer

## Overview
An interactive web-based application that allows users to clone Git repositories from multiple providers (GitHub, GitLab, Azure DevOps, Bitbucket) and analyze them using AI-powered insights.

## Current State
- Multi-panel UI with repository cloning, file tree visualization, and AI analysis
- GitHub and GitLab authentication support with multiple methods (OAuth, PAT, credentials)
- OpenAI integration for code analysis
- C#-compatible backend architecture with extensible provider pattern

## Recent Changes
- 2025-09-12: Initial implementation with working web UI
- Fixed storage interface to support repositories and analysis reports
- Added Express session support for authentication
- Configured OpenAI integration with API key

## User Preferences
- Wants C#-compatible backend interface architecture
- Requires GitHub integration without using Replit's GitHub connector (user dismissed it)
- Needs support for multiple Git providers with extensible pattern
- OpenAI integration for code analysis and report generation

## Project Architecture
- Frontend: React with TypeScript, TanStack Query, Tailwind CSS
- Backend: Express.js with TypeScript as bridge to C# backend
- Storage: In-memory storage (MemStorage) as per guidelines
- Authentication: Session-based with multiple provider support

## Important Notes
- GitHub authentication currently uses manual implementation instead of Replit connector
- User dismissed connector:ccfg_github_01K4B9XD3VRVD2F99YM91YTCAF integration
- Need to implement GitHub authentication with user-provided credentials/tokens
- OpenAI API key configured and ready for code analysis features

## MVP Features Status
- ✅ Multi-panel UI layout working
- ✅ File tree visualization implemented
- ✅ OpenAI integration configured
- 🔄 GitHub authentication (needs manual credentials setup)
- 🔄 Repository cloning functionality
- ⏳ GitLab authentication support
- ⏳ C# interface structure completion

## Next Steps
1. Complete authentication flow for GitHub with manual credentials
2. Test repository cloning functionality
3. Implement and test GitLab authentication
4. Complete C# interface structure with dummy providers
5. Test OpenAI code analysis features

## GitHub Push Capability
- Automated GitHub push scripts available for future code deployment
- Repository: https://github.com/AbhishekGupta-Landmark/RepoCloner
- Can push code changes to GitHub repository using environment variable GITHUB_PERSONAL_ACCESS_TOKEN
- Scripts removed from main project to keep solution clean