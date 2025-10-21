# AI Migration Tool - Git Repository Analyzer & AI-Powered Migration Assistant

## Overview

AI Migration Tool is a comprehensive web-based application for cloning Git repositories from multiple providers (GitHub, GitLab, Azure DevOps, Bitbucket, Gitea, Codeberg, SourceHut), analyzing their technology stack, and providing detailed insights with AI-powered code analysis and migration strategies. The application features multi-account OAuth authentication, automatic technology detection across 70+ patterns, and Python-based migration analysis capabilities with three analysis modes: Migration Analysis, Quick Migration Analysis, and Comprehensive Migration Analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (October 21, 2025)

### Multi-Account Authentication Consolidation & Account Switching Fix
- **Goal**: Centralize all authentication in Settings panel with proper multi-account switching
- **Changes**:
  - Removed "Sign In" button from header - Settings → Git Connection is now the only authentication entry point
  - Fixed OAuth account switching: Added accounts query invalidation to OAuth callback handler
  - Fixed PAT account switching: Removed manual user state setting in authenticateMutation to let queries handle it
  - Backend addAccount() now always sets newly added accounts as active
- **Implementation**:
  - client/src/pages/MainPage.tsx: Removed Sign In button UI
  - client/src/hooks/useAuth.tsx: Fixed query invalidation for both OAuth and PAT flows
  - server/routes.ts: Modified addAccount() to always activate new accounts
- **Result**: 
  - ✅ Single authentication source: Settings → Git Connection tab
  - ✅ Both OAuth and PAT now correctly switch to newly added account
  - ✅ Consistent multi-account behavior across authentication methods
  - ✅ Account deduplication works properly using provider + providerUserId

## Recent Changes (October 15, 2025)

### Cache Management Fix
- **Issue**: Reports not displaying after successful analysis due to stale failed cache
- **Solution**: Modified `useAnalysis` hook to clear old cache before setting success status
- **Implementation**: Added `removeQueries()` before `setQueryData()` and force refetch with `invalidateQueries()`
- **Result**: Reports now display immediately after successful analysis

### Branch Cleanup Automation
- **Issue**: Multiple old branches cluttering the repository (12+ branches)
- **Solution**: Added automatic branch deletion to `pushSpecificFiles.ts`
- **Implementation**: 
  - `getAllBranches()` - Fetches all repository branches via GraphQL
  - `deleteBranch()` - Deletes branch by ID
  - `deleteAllBranchesExceptMain()` - Removes all non-main branches before creating new branch
- **Result**: Repository stays clean with only main + current working branch

### Reports Panel Visibility Fix
- **Issue**: Reports section empty because failed analyses were filtered out
- **Solution**: Modified `ReportsPanel.tsx` to display failed analyses in history
- **Implementation**:
  - Show reports with files OR failed reports (not just successful ones)
  - Display failed reports with red border + "Failed" badge
  - Show error message instead of description for failed reports
  - Hide View/Download buttons for failed reports (no files generated)
- **Result**: Users can see complete analysis history including failures

### Comprehensive Migration Analysis Report Generation Fix
- **Issue**: default3.py generates report but backend can't find it
- **Root Cause**: Script outputs `report_file` but backend expects `generatedFiles` array
- **Solution**: Modified default3.py JSON output to include `generatedFiles` array with file metadata
- **Implementation**: Changed output format from `{"report_file": "..."}` to `{"generatedFiles": [{"name": "...", "path": "...", "type": "..."}]}`
- **Result**: Comprehensive Migration Analysis now properly generates and displays reports in UI

### Critical Failed Report Detection Bug Fix
- **Issue**: Successful comprehensive migration reports shown as "Failed" in UI
- **Root Cause 1**: `exitCode !== 0` evaluates to `true` when `exitCode` is `undefined` (successful reports don't set exitCode)
- **Root Cause 2**: default3.py line 151 printed debug output to stderr, causing backend to detect error
- **Solution**: 
  - Modified failure check to only mark as failed if `exitCode` is defined AND not 0, or if error exists
  - Removed stderr debug print statement from default3.py
- **Implementation**: 
  - Changed from `exitCode !== 0` to `(exitCode !== undefined && exitCode !== 0)`
  - Removed `print(f"Output: ...", file=sys.stderr)` line
- **Result**: Successful reports now display correctly with View/Download buttons instead of "Failed" badge

### Download Button Visibility Fix
- **Issue**: View/Download buttons not showing for comprehensive migration reports
- **Root Cause**: Button visibility logic only checked for 'python-script' or 'migration' analysis types
- **Solution**: Added 'quick-migration-1' and 'comprehensive-migration' to button visibility condition
- **Implementation**: Modified ReportsPanel.tsx line 433 to include all migration analysis types
- **Result**: View and Download buttons now appear for all migration reports with generated files

### Reports Not Showing in UI (Empty Reports List)
- **Issue**: Reports completely missing from UI despite successful generation
- **Root Cause**: API endpoint only scanned root directory, missing `.reports` subdirectory where comprehensive-migration-report.md was created
- **Additional Cause**: No pattern matching for comprehensive-migration-report files
- **Solution**: 
  - Modified API to scan both root directory AND `.reports` subdirectory
  - Added comprehensiveMigrationReports pattern: `file.includes('comprehensive-migration-report')`
  - Added processing loop for comprehensive migration reports with type 'comprehensive-migration-report'
- **Implementation**: Updated `/api/analysis/reports/:repositoryId` endpoint in routes.ts
- **Result**: Reports now properly discovered from `.reports` folder and displayed in frontend

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18.3.1 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR
- Tailwind CSS for utility-first styling with custom theme variables
- Radix UI for accessible, unstyled component primitives

**State Management & Data Fetching:**
- TanStack React Query (v5.60.5) for server state management and caching
- Custom hooks (useAnalysis, useRepositories) encapsulate business logic
- React Hook Form for performant form handling with validation

**Routing & Navigation:**
- Wouter (v3.3.5) - lightweight routing library instead of React Router
- File-based route structure in client/src directory

**UI Components:**
- Shadcn/ui component system with New York style preset
- Framer Motion for animations and transitions
- Lucide React and React Icons for iconography
- Custom components in client/src/components directory

**Design Decisions:**
- Chose Radix UI primitives for accessibility compliance without imposing visual styles
- TanStack Query selected for powerful caching and background refetching capabilities
- Wouter chosen over React Router for minimal bundle size
- Custom theme system using CSS variables for easy dark/light mode switching

### Backend Architecture

**Server Framework:**
- Express.js 4.21.2 with TypeScript for type-safe API development
- TSX for TypeScript execution in development environment
- Session-based authentication with express-session and MemoryStore

**API Design:**
- RESTful API endpoints organized in server/routes.ts
- Service layer pattern for business logic separation
- Python script execution service for repository analysis

**Repository Management:**
- Git operations using native git commands via child_process
- Multi-provider OAuth integration (@octokit/rest for GitHub)
- File system operations for cloning and analysis
- Temporary directory management in /temp folder

**Analysis System:**
- Technology detection engine with 70+ pattern recognition
- Python script registry supporting multiple analysis types (default, quick-migration-1, comprehensive-migration)
- AI-powered code analysis using configurable AI endpoints
- Structured report generation and storage
- Three migration analysis modes:
  - Migration Analysis: Standard Kafka to Azure Service Bus migration analysis
  - Quick Migration Analysis: Streamlined migration assessment
  - Comprehensive Migration Analysis: Complete migration strategy and roadmap

**Design Decisions:**
- Express chosen for its maturity and extensive middleware ecosystem
- Service layer separates API routes from business logic for testability
- Python integration allows extensible analysis without rebuilding Node.js application
- In-memory session storage for development (should migrate to Redis/database for production)

### Data Storage

**ORM & Database Schema:**
- Drizzle ORM (v0.39.1) with Drizzle Kit for migrations
- PostgreSQL dialect defined in schema (shared/schema.ts)
- Current implementation uses in-memory storage for development
- Schema includes repositories, technologies, users, OAuth accounts, and analysis reports

**Data Models:**
- Repository metadata (name, URL, provider, clone path)
- Technology stack detection results
- User accounts and OAuth provider associations
- Analysis reports with structured JSON storage

**Design Decisions:**
- Drizzle ORM selected for type-safe database operations and lightweight footprint
- Schema designed for multi-tenant OAuth support
- JSON storage for flexible report structures
- Migration strategy defined but PostgreSQL connection pending provisioning

**Note:** While the schema is designed for PostgreSQL, the application currently operates with in-memory storage. Production deployment will require DATABASE_URL configuration and migration execution.

### Authentication & Authorization

**OAuth 2.0 Implementation:**
- Multi-provider OAuth flow (GitHub, GitLab fully implemented)
- Browser-based authentication with callback handling
- Personal Access Token support as alternative to OAuth
- Session-based authentication state management

**Account Management:**
- Multi-account support with Gmail-style account switching
- Concurrent session handling across providers
- OAuth configuration stored in admin settings
- Secure token storage and refresh mechanisms

**Design Decisions:**
- OAuth 2.0 chosen over username/password for security best practices
- Session-based auth simplifies client-side state management
- Multi-account architecture supports enterprise workflows
- Admin panel for OAuth client configuration per provider

### External Dependencies

**Git Providers:**
- GitHub API via @octokit/rest (v22.0.0)
- GitLab API integration
- Partial support for Azure DevOps, Bitbucket, Gitea, Codeberg, SourceHut

**AI Services:**
- Configurable AI endpoint (supports OpenAI-compatible APIs)
- Custom AI proxy support (e.g., ai-proxy.lab.epam.com)
- API key and model configuration through admin settings
- Used for code analysis and test coverage generation

**Python Runtime:**
- Python scripts for repository analysis (scripts/default.py, scripts/default2.py)
- Cross-platform Python execution (py, python, python3 fallback)
- Analysis type registry system for extensible script management
- JSON-based report output format

**Build & Development Tools:**
- Vite for frontend bundling and dev server
- esbuild for server-side bundling
- Vitest for unit testing with coverage
- Playwright for end-to-end testing

**File Operations:**
- Archiver (v7.0.1) for repository download as ZIP
- mime-types for file type detection
- File tree generation and individual file downloads

**Design Decisions:**
- Octokit chosen as official GitHub API library with comprehensive features
- AI integration designed to be provider-agnostic through configuration
- Python selected for analysis scripts due to rich data science ecosystem
- Archiver enables repository portability through ZIP exports