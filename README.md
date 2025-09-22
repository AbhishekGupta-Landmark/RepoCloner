# Git Repository Cloner & Analyzer

A comprehensive web-based application for cloning Git repositories from multiple providers, analyzing their technology stack, and providing detailed insights with AI-powered code analysis.

## 🚀 Features

- **Multi-Provider Support**: Clone repositories from GitHub and GitLab (fully implemented), with additional providers planned
- **OAuth Authentication**: Secure sign-in with multiple Git providers simultaneously
- **Multi-Account Management**: Gmail-style account switching with support for multiple concurrent sessions
- **Technology Detection**: Automatic detection of programming languages, frameworks, and tools
- **AI-Powered Analysis**: OpenAI integration for intelligent code analysis and insights
- **File Structure Visualization**: Interactive file tree with download capabilities
- **Activity Logging**: Real-time logging system with color-coded messages
- **Responsive UI**: Modern, mobile-friendly interface with dark/light theme support
- **Personal Repository Creation**: Create copies of analyzed repositories in your personal GitHub account

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
- **Next Themes** (0.4.6) - Dark/light theme switching
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
- **Multi-Provider OAuth 2.0** - Secure authentication with:
  - GitHub
  - GitLab
  - Azure DevOps
  - Bitbucket
  - Gitea
  - Codeberg
  - SourceHut
- **Session-based Authentication** - Secure session management
- **Multi-Account Support** - Concurrent authentication with multiple providers

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
- OAuth credentials for Git providers (optional, for multi-provider authentication)

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Configure OAuth credentials in the settings panel
4. Set up environment variables (OpenAI API key, etc.)
5. Run development server: `npm run dev`

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Database schema migration

## 🌟 Key Features Breakdown

### Multi-Provider Authentication
- Simultaneous authentication with multiple Git providers
- Gmail-style account switching interface
- Secure OAuth 2.0 implementation with proper scope management
- Session persistence and management

### Repository Analysis
- Automatic technology stack detection (70+ technology patterns)
- File structure visualization with interactive tree
- AI-powered code analysis and insights
- Download individual files or entire repositories

### Real-time Activity Logging
- 5-color coded logging system for different log types
- Live activity updates through in-memory logging service
- Exportable log files
- Structured logging with timestamps and source identification

### Modern UI/UX
- Responsive design with mobile support
- Accessible components with proper ARIA support
- Dark/light theme with system preference detection
- Smooth animations and transitions with Framer Motion

## 📦 Project Structure
```
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # React context providers
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions
│   │   └── pages/        # Page components
├── server/               # Backend Express application
│   ├── services/         # Business logic services
│   ├── routes.ts         # API route definitions
│   └── storage.ts        # Data access layer
├── shared/               # Shared types and schemas
└── temp/                 # Temporary files (Git clones)
```

## 🔐 Security Features
- Secure OAuth 2.0 implementation
- Session-based authentication
- Environment variable protection
- API key management
- Input validation and sanitization

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