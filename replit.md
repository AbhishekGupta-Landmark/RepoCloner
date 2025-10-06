# Git Repository Cloner & Analyzer

## Overview
This project is an interactive web-based application designed to clone Git repositories from various providers (GitHub, GitLab, Azure DevOps, Bitbucket) and provide AI-powered analysis. The core purpose is to offer insightful analytics on codebases, aiding developers in understanding, maintaining, and migrating their projects. The ambition is to create a versatile tool that integrates seamlessly with existing Git workflows and leverages advanced AI for actionable intelligence.

## User Preferences
- Wants C#-compatible backend interface architecture
- Requires GitHub integration without using Replit's GitHub connector (user dismissed it)
- Needs support for multiple Git providers with extensible pattern
- OpenAI integration for code analysis and report generation
- User prefers manual git push using their personal access token via shell commands

## System Architecture
The application features a multi-panel UI for repository cloning, file tree visualization, and AI analysis. The frontend is built with React, TypeScript, TanStack Query, and Tailwind CSS, focusing on a responsive grid layout, equal-height components, and enhanced text wrapping. The backend, an Express.js application with TypeScript, acts as a bridge to a C# compatible backend structure, employing an extensible provider pattern for Git services. Authentication is session-based, supporting multiple providers. For storage, an in-memory solution (MemStorage) is used. The system includes a dynamic analysis types system, allowing new AI analysis capabilities to be added by simply placing Python scripts in a designated directory. A significant feature is the AI-powered "Initial Test Coverage and Validation" analysis, which uses Python scripts to generate detailed test coverage reports in JSON format, providing file-level metrics, new test cases added, and generated test code previews. Robust JSON parsing with validation ensures data integrity from AI responses, handling various edge cases. All AI configuration is strictly managed through the UI, with no fallback constants or environment variables for critical AI settings.

## Recent Changes
- 2025-10-06: **SIMPLIFIED JSON PARSING - NO REGEX** - Commit d7fec93 (USER FEEDBACK + ARCHITECT APPROVED ✅)
  - **USER WAS RIGHT**: Removed all complex regex patterns for JSON parsing (inaccurate and overcomplicated)
  - **Simple 3-Strategy Approach**: (1) Direct json.loads(), (2) Simple string ops for markdown, (3) JSONDecoder for prose
  - **Field Validation**: is_valid_result() prevents KeyErrors by checking required fields exist
  - **Updated AI Prompt**: Explicitly demands "ONLY valid JSON - nothing else!" (no markdown, no explanations)
  - **Clean & Robust**: Handles pure JSON, markdown-fenced JSON, and prose+JSON without complex regex
  - **Result**: Simple deserialization works as expected, NEW TESTS ADDED shows actual count (6) instead of 0

## External Dependencies
- **Git Providers**: GitHub, GitLab, Azure DevOps, Bitbucket (planned)
- **AI/ML**: OpenAI (for code analysis and report generation)
- **Authentication**: OAuth, Personal Access Tokens (PAT), Credentials
- **Backend Languages**: Python (for AI analysis scripts)