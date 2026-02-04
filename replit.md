# Authentication API

## Overview

A full-stack authentication REST API application built with Express.js backend and React frontend. The system provides user registration, login, password management, and session-based authentication with Swagger API documentation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Documentation**: Swagger UI with swagger-jsdoc for auto-generated OpenAPI docs
- **Authentication**: Token-based session management with in-memory storage
- **Password Security**: bcryptjs for password hashing
- **Validation**: Zod schemas shared between client and server

### Data Storage
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema Location**: `shared/schema.ts` contains database tables and Zod validation schemas
- **Current Storage**: In-memory storage implementation (`MemStorage`) with interface for database migration
- **Database Ready**: Drizzle config expects `DATABASE_URL` environment variable for PostgreSQL connection

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/ui/  # shadcn/ui components
│       ├── pages/          # Route pages
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities and query client
├── server/           # Express backend
│   ├── routes.ts     # API endpoints
│   ├── storage.ts    # Data access layer
│   └── swagger.ts    # API documentation config
├── shared/           # Shared code between client/server
│   └── schema.ts     # Database schema and validation
└── migrations/       # Drizzle database migrations
```

### API Endpoints
- `POST /api/register` - User registration
- `POST /api/login` - User authentication
- `POST /api/forgot-password` - Password reset request
- `POST /api/reset-password` - Password reset with token
- `POST /api/change-password` - Authenticated password change
- `GET /api/me` - Get current user (authenticated)
- `GET /api-docs` - Swagger UI documentation

### Build Process
- Development: Vite dev server with Express middleware
- Production: esbuild bundles server, Vite builds client to `dist/public`

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations via `npm run db:push`

### Authentication & Security
- **bcryptjs**: Password hashing
- **express-session**: Session management (configured for connect-pg-simple)

### API Documentation
- **swagger-jsdoc**: Generate OpenAPI specs from JSDoc comments
- **swagger-ui-express**: Serve interactive API documentation

### UI Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant management