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
- 2025-10-07: **QUICK MIGRATION ANALYSIS - REMOVED ALL FALLBACK** - Direct push to main (USER CRITICAL FIX 🚨)
  - **ISSUE**: Quick Migration Analysis still showing "fallback shit" - manual detection entries
  - **ROOT CAUSE**: Script was adding manual keyword detection results when AI didn't return "yes"/"maybe"
  - **SOLUTION**: Completely removed manual detection from inventory/diffs - ONLY AI results shown now
  - **Behavior**: If AI doesn't detect files, report will be empty (no fallback entries)
  - **Result**: Quick Migration Analysis now shows ONLY AI-powered results, zero fallback logic

- 2025-10-07: **REPOSITORY CLEANUP COMPLETED** - Direct push to main
  - **Removed**: .local/state/replit/agent (535 files!) from main branch via GitHub API
  - **Removed**: attached_assets/ folder (192 files) from main branch via GitHub API
  - **Updated .gitignore**: Added .local/, *.log, __pycache__/, *.py[cod], .pytest_cache/, .coverage, .env.local
  - **Created**: server/scripts/deleteFilesFromGit.ts for bulk file deletion from remote repository
  - **Verified**: No development-only files remain in repository, application runs without issues
  - **Result**: Clean repository ready for deployment, ~727 unnecessary files removed from git history

- 2025-10-07: **RESTORED ORIGINAL QUICK MIGRATION LOGIC** - Direct push to main (USER CRITICAL FIX 🚨)
  - **ISSUE**: Attempted "smart fallback" broke the working Quick Migration Analysis
  - **PROBLEM**: Reports became nearly empty (only NuGet changes, no Kafka files)
  - **ROOT CAUSE**: Changed logic to only show manual detection when AI found ZERO files
  - **SOLUTION**: Restored original behavior - manual detection ALWAYS shows (unless AI already found those files)
  - **How It Works Now**: 
    1. AI analyzes files and shows results (if uses_kafka = "yes"/"maybe")
    2. Manual keyword detection shows files not already found by AI
    3. Both results displayed in separate sections of the report
  - **Result**: Quick Migration Analysis works exactly like before - full reports with data

- 2025-10-07: **REMOVED FALLBACK FROM CODE ANALYSIS** - Direct push to main
  - **Code Analysis (default.py)**: Removed static analysis fallback - fails cleanly without AI
  - **Reason**: Prevents misleading "fake" reports when AI analysis fails

- 2025-10-07: **FIXED DROPDOWN STATE SYNC BUG** - Direct push to main (USER CRITICAL FIX 🚨)
  - **ISSUE**: UI showed "Quick Migration Analysis" selected but executed "default" analysis
  - **ROOT CAUSE**: Auto-selection + async React state updates caused race condition
  - **SOLUTION**: Removed auto-selection - users must explicitly choose analysis type from dropdown
  - **Result**: Dropdown sends exactly what user selects, no more state synchronization issues
  
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