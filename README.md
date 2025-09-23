# Git Repository Cloner & Analyzer

A comprehensive web-based application for cloning Git repositories from multiple providers, analyzing their technology stack, and providing detailed insights with AI-powered code analysis.

## 🚀 Features

- **Multi-Provider Support**: Clone repositories from GitHub and GitLab (fully implemented), with Azure DevOps, Bitbucket, Gitea, Codeberg, and SourceHut (partial implementation)
- **Modern Authentication**: Secure OAuth 2.0 and Personal Access Token authentication (no username/password required)
- **Multi-Account Management**: Gmail-style account switching with support for multiple concurrent sessions
- **Enhanced Technology Detection**: Automatic detection of 70+ technology patterns with improved README file categorization
- **AI-Powered Analysis**: OpenAI integration for intelligent code analysis and insights
- **Advanced File Operations**: Interactive file tree with individual file downloads and repository cloning
- **Auto-Refresh Interface**: Smart UI updates when settings change or repository operations complete
- **Smooth Grid Transitions**: Fluid animations when expanding/collapsing technology stack details
- **Real-time Activity Logging**: Live logging system with color-coded messages and structured output
- **Responsive UI**: Modern, mobile-friendly interface with dark/light theme support and accessibility features

## 🛠 Technologies Used

### Frontend Technologies
- **React** (18.3.1) - Modern JavaScript library for building user interfaces
- **TypeScript** (5.6.3) - Typed superset of JavaScript for enhanced development experience
- **Vite** (5.4.19) - Fast build tool and development server
- **Tailwind CSS** (3.4.17) - Utility-first CSS framework for rapid UI development
- **Radix UI Components** - Accessible, unstyled UI components:
  - Dialog, Dropdown Menu, Select, Tabs, Toast, Tooltip, Progress, and more
- **TanStack React Query** (5.60.5) - Powerful data synchronization for React
- **Wouter** (3.3.5) - Minimalist routing library for React
- **React Hook Form** (7.55.0) - Performant forms with easy validation
- **Framer Motion** (11.18.2) - Production-ready motion library for React
- **Lucide React** (0.453.0) - Beautiful & consistent icon library
- **React Icons** (5.5.0) - Popular icon library with multiple icon sets

### Backend Technologies
- **Node.js** - JavaScript runtime for server-side development
- **Express.js** (4.21.2) - Fast, unopinionated web framework
- **TypeScript** - Type-safe server-side development
- **WS** (8.18.0) - WebSocket dependency (installed but not actively used for real-time features)
- **Express Session** (1.18.1) - Session management middleware
- **MemoryStore** (1.6.7) - In-memory session storage
- **TSX** (4.19.1) - TypeScript execution environment

### Database & ORM
- **Drizzle ORM** (0.39.1) - Lightweight TypeScript ORM
- **Drizzle Kit** (0.30.4) - Database migration and management tools
- **Drizzle Zod** (0.7.0) - Schema validation integration
- **PostgreSQL** - Relational database (schema defined, using in-memory storage for development)

### Authentication & OAuth
- **OAuth 2.0 Authentication** - Secure browser-based authentication with:
  - GitHub (configuration required)
  - GitLab
  - Azure DevOps
  - Bitbucket
  - Codeberg
- **Personal Access Token Support** - Token-based authentication for:
  - GitHub (recommended)
  - GitLab
  - Azure DevOps
  - Gitea
  - Codeberg
  - SourceHut
- **Session-based Management** - Secure session handling with multi-account support
- **No Password Storage** - Enhanced security with no username/password authentication required

### API Integrations
- **GitHub API** (@octokit/rest 22.0.0) - GitHub REST API integration
- **GitLab API** - GitLab REST API integration
- **OpenAI API** (5.20.1) - AI-powered code analysis and insights
- **Git Provider APIs** - Universal integration with multiple Git hosting services

### Development & Build Tools
- **Vite** - Lightning-fast build tool with HMR
- **ESBuild** (0.25.0) - Extremely fast JavaScript bundler
- **PostCSS** (8.4.47) - CSS transformation tool
- **Autoprefixer** (10.4.20) - CSS vendor prefix automation
- **Tailwind CSS Plugins**:
  - @tailwindcss/typography (0.5.15)
  - @tailwindcss/vite (4.1.3)
  - tailwindcss-animate (1.0.7)

### Validation & Type Safety
- **Zod** (3.24.2) - TypeScript-first schema validation
- **Zod Validation Error** (3.4.0) - Enhanced error handling
- **@hookform/resolvers** (3.10.0) - Form validation resolvers

### File Operations & Utilities
- **Archiver** (7.0.1) - File compression and archiving
- **MIME Types** (3.0.1) - MIME type detection and handling
- **Date-fns** (3.6.0) - Modern JavaScript date utility library
- **Class Variance Authority** (0.7.1) - CSS class utility functions
- **clsx** (2.1.1) - Utility for constructing className strings
- **Tailwind Merge** (2.6.0) - Utility to merge Tailwind CSS classes

### UI Enhancement Libraries
- **CMDK** (1.1.1) - Command palette interface
- **React Resizable Panels** (2.1.7) - Resizable panel components
- **tw-animate-css** (1.2.5) - CSS animations for Tailwind

### Development Environment
- **Replit Platform** - Cloud development environment
- **Replit Vite Plugins**:
  - @replit/vite-plugin-cartographer (0.3.0)
  - @replit/vite-plugin-runtime-error-modal (0.0.3)

## 🏗 Architecture

### Frontend Architecture
- **Component-Based**: Modular React components with TypeScript
- **State Management**: TanStack Query for server state, React Context for client state
- **Routing**: Client-side routing with Wouter
- **Styling**: Utility-first CSS with Tailwind and component library integration
- **Theme System**: Dark/light mode with system preference detection

### Backend Architecture
- **RESTful API**: Express.js server with TypeScript
- **Middleware**: Session management, request logging, error handling
- **Service Layer**: Modular services for Git providers, OpenAI, and technology detection
- **OAuth Flow**: Secure authentication with multiple providers
- **Activity Logging**: In-memory logging service with React state updates

### Data Layer
- **Schema Definition**: Strongly typed database schema with Drizzle ORM
- **In-Memory Storage**: Primary storage interface for development
- **Validation**: Runtime validation with Zod schemas  
- **Type Safety**: End-to-end type safety from schema to frontend
- **Database Schema**: PostgreSQL schema definitions (optional, not required for in-memory mode)

## 🔧 Setup & Development

### Prerequisites
- Node.js (Latest LTS version)
- Git (for repository cloning functionality)
- OpenAI API key (required for AI analysis features)
- Git provider credentials:
  - **OAuth Apps** (recommended): Client ID and Secret for each provider
  - **Personal Access Tokens**: For token-based authentication (all providers except Bitbucket)

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Configure OAuth credentials in the settings panel
4. Set up environment variables (OpenAI API key, etc.)
5. Run development server: `npm run dev`

## 🛠 Development Guide

### Development Workflow
1. **Start Development**: `npm run dev` - Starts both frontend and backend with hot reload
2. **Run Tests**: `npx vitest --config vitest.config.ts --watch` - Run tests in watch mode during development
3. **Type Checking**: `npm run check` - Verify TypeScript types
4. **Code Quality**: Manual code review and comprehensive testing

### Testing During Development
```bash
# Watch mode for immediate feedback
npx vitest --config vitest.config.ts --watch

# Test specific components while developing
npx vitest run client/src/components/YourComponent.test.tsx --watch

# Quick coverage check
npx vitest run --config vitest.config.ts --coverage
```

### Project Development Standards
- **TypeScript First**: All code written in TypeScript with strict type checking
- **Component Testing**: Every component must have corresponding test file
- **Test-Driven Development**: Write tests alongside or before implementation
- **Zero Console Errors**: Development environment should be free of console errors
- **Comprehensive Coverage**: Aim for high test coverage on all new features

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Database schema migration

### Testing Commands
```bash
# Frontend tests with Vitest
npx vitest run --config vitest.config.ts                    # Run all frontend tests
npx vitest --config vitest.config.ts --watch               # Watch mode for development
npx vitest run --config vitest.config.ts --coverage        # Run with coverage report

# Backend tests
npx vitest run --config vitest.server.config.ts            # Run backend/server tests

# End-to-end tests with Playwright
npx playwright test                                         # Run E2E tests
npx playwright test --ui                                    # Run E2E tests with UI

# Specific component tests
npx vitest run client/src/components/AuthModal.test.tsx    # Test specific component
```

### Code Quality & Analysis
- `npm run check` - TypeScript type checking for both frontend and backend
- Manual code review and testing for quality assurance

## 🌟 Key Features Breakdown

### Multi-Provider Authentication
- **Dual Authentication Methods**: OAuth 2.0 and Personal Access Tokens (PAT recommended for most providers)
- **Multi-Provider Access**: Concurrent authentication with GitHub, GitLab, and additional providers
- **Gmail-Style Account Management**: Intuitive account switching with visual indicators
- **Enhanced Security**: No username/password storage, token-based authentication with proper scope management
- **Smart Session Management**: Persistent sessions with automatic refresh capabilities

### Repository Analysis
- **Advanced Technology Detection**: 70+ technology patterns with smart categorization
- **README File Recognition**: Documentation files properly categorized in Documentation section
- **Interactive File Tree**: Browse repository structure with real-time navigation
- **Individual File Downloads**: Download specific files directly from the Details view Evidence section
- **AI-Powered Insights**: OpenAI integration for intelligent code analysis and recommendations
- **Repository Cloning**: Complete repository download and analysis capabilities

### Real-time Activity Logging
- 5-color coded logging system for different log types
- Live activity updates through in-memory logging service
- Exportable log files
- Structured logging with timestamps and source identification

### Modern UI/UX
- **Auto-Refresh Interface**: Automatic UI updates when settings change or operations complete
- **Equal Height Grid Layout**: Uniform card heights across all view modes with scrollable content areas
- **Responsive Grid System**: Adaptive layout from 1 to 5 columns (grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5)
- **Enhanced Text Wrapping**: Natural word boundaries with proper file path handling and category badge positioning
- **Smooth Grid Transitions**: Fluid animations for technology showcase expand/collapse actions
- **Responsive Design**: Mobile-optimized interface with touch-friendly interactions
- **Accessibility First**: Comprehensive ARIA support and keyboard navigation
- **Advanced Theming**: Dark/light mode with system preference detection and smooth transitions
- **Micro-Interactions**: Enhanced user experience with Framer Motion animations and visual feedback

## 📦 Project Structure
```
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   │   ├── ui/       # Shadcn/UI component library
│   │   │   └── *.test.tsx # Component tests
│   │   ├── context/      # React context providers
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions
│   │   ├── pages/        # Page components
│   │   └── test-utils.tsx # Shared testing utilities
├── server/               # Backend Express application
│   ├── services/         # Business logic services
│   ├── routes.ts         # API route definitions
│   ├── routes.test.ts    # Backend API tests
│   └── storage.ts        # Data access layer
├── shared/               # Shared types and schemas
├── tests/                # Test configuration and E2E tests
│   ├── e2e/              # End-to-end tests (Playwright)
│   ├── mocks/            # MSW mock handlers
│   └── setup.ts          # Test environment setup
├── coverage/             # Test coverage reports (generated)
├── vitest.config.ts      # Frontend test configuration
└── vitest.server.config.ts # Backend test configuration
```

## 🧪 Testing & Quality Assurance

### Comprehensive Test Suite
The project includes a comprehensive testing infrastructure covering all aspects of the application:

- **Frontend Component Tests**: Complete behavioral testing of all React components with user interaction simulations
- **Backend API Tests**: Full coverage of authentication, repository operations, analysis flows, and error handling
- **End-to-End Tests**: Complete user journey testing (auth → clone → analyze → reports workflows)
- **Hook & Context Tests**: Comprehensive testing of custom React hooks and context providers
- **Integration Tests**: Cross-component testing with real API interactions

### Test Coverage Goals
- **Target Coverage**: 100% comprehensive test coverage
- **Current Status**: 58+ tests covering all major functionality
- **Coverage Reports**: Generated in multiple formats (HTML, JSON, text)

### Running Tests

#### Quick Testing Commands
```bash
# Run all frontend tests
npx vitest run --config vitest.config.ts

# Run with coverage report
npx vitest run --config vitest.config.ts --coverage

# Run specific component tests
npx vitest run client/src/components/AuthModal.test.tsx

# Run backend tests
npx vitest run server/routes.test.ts

# Run tests in watch mode (for development)
npx vitest --config vitest.config.ts --watch
```

#### Detailed Test Commands
```bash
# Frontend component tests (individual)
npx vitest run client/src/components/AnalysisPanel.test.tsx
npx vitest run client/src/components/RepositoryInput.test.tsx
npx vitest run client/src/components/ReportsPanel.test.tsx
npx vitest run client/src/components/LogsPanel.test.tsx

# Hook and context tests
npx vitest run client/src/hooks/useCloning.test.tsx
npx vitest run client/src/context/AppContext.test.tsx

# Backend API tests
npx vitest run server/routes.test.ts

# End-to-end tests
npx playwright test tests/e2e/
```

#### Coverage Reports
```bash
# Generate coverage reports in multiple formats
npx vitest run --coverage

# View coverage reports
# HTML: coverage/index.html (interactive browsable report)
# JSON: coverage/coverage-final.json (machine-readable)
# Terminal: Displayed automatically during test runs
```

### Test Infrastructure Features
- **Stable Test Utilities**: Shared `renderWithProviders` with React Query and context mocking
- **MSW Integration**: Mock Service Worker for consistent API testing
- **Component Isolation**: Each component tested independently with proper mocking
- **Behavioral Testing**: Focus on user interactions and real-world scenarios
- **Error Handling**: Comprehensive error path testing for robustness

### Quality Standards
- **Zero Failing Tests**: All tests must pass before deployment
- **Behavioral Coverage**: Tests focus on user interactions, not implementation details
- **Cross-Platform Testing**: Tests run consistently across development environments
- **Maintainable Tests**: Clean, readable test code with proper organization

## 🔐 Security Features
- **Modern Authentication Only**: OAuth 2.0 and Personal Access Tokens (no password authentication)
- **Secure Session Management**: Encrypted session handling with automatic invalidation
- **Environment Variable Protection**: Secure credential storage and masked display
- **API Key Management**: Secure OpenAI and Git provider API key handling
- **Input Validation**: Comprehensive Zod schema validation and sanitization
- **No Credential Storage**: OAuth tokens and PATs handled securely without persistent storage of sensitive data

## 🚀 Deployment
Built for deployment on Replit platform with automatic:
- Port configuration (auto-assigned on Replit)
- Environment variable management
- Static file serving
- Production optimization

## 📄 License
MIT License - see the [LICENSE](LICENSE) file for details

---

## 🔧 OAuth Provider Setup

### GitHub OAuth Setup
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App with these settings:
   - **Application name**: Git Repository Cloner & Analyzer
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-domain.com/api/auth/callback/github`
3. Copy Client ID and Client Secret
4. Add to environment variables or configure in app Settings panel

### GitLab OAuth Setup  
1. Go to GitLab User Settings → Applications
2. Create new application with these settings:
   - **Name**: Git Repository Cloner & Analyzer
   - **Redirect URI**: `https://your-domain.com/api/auth/callback/gitlab`
   - **Scopes**: `read_user`, `read_repository`, `write_repository`
3. Copy Application ID and Secret
4. Add to environment variables or configure in app Settings panel

### Personal Access Token Setup (Recommended)
For most providers, Personal Access Tokens are the recommended authentication method:

#### GitHub PAT:
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with scopes: `repo`, `user:email`
3. Copy the token and use it in the application

#### GitLab PAT:
1. Go to GitLab User Settings → Access Tokens
2. Create personal access token with scopes: `read_user`, `read_repository`, `write_repository`
3. Copy the token and use it in the application

### Environment Variables Reference
```env
# Required
OPENAI_API_KEY=sk-... # OpenAI API key for AI analysis
SESSION_SECRET=your-random-secret # Session encryption key

# Optional OAuth Credentials  
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITLAB_CLIENT_ID=your_gitlab_application_id
GITLAB_CLIENT_SECRET=your_gitlab_application_secret

# Optional Configuration
NODE_ENV=development
PORT=5000 # Auto-assigned on Replit
```

### Activity Logging Details
The application uses an in-memory logging service (`logService.logs`) to maintain activity logs. Logs are displayed in real-time through React state updates, providing immediate feedback for all operations without requiring external endpoints.

---

**Built with modern web technologies for seamless Git repository management and analysis.**