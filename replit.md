# Authentication & Payment APIs

## Overview

A backend-only REST API application built with Express.js providing user authentication and integration with OneCard Nigeria API for payment/recharge services and OneBigPie API for user management and voucher subscriptions. The system includes user registration, login, password management, and Swagger API documentation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Documentation**: Swagger UI with swagger-jsdoc for auto-generated OpenAPI docs
- **Authentication**: Token-based session management with in-memory storage
- **Password Security**: bcryptjs for password hashing
- **Validation**: Zod schemas shared between client and server
- **OneCard Integration**: AES-128-CBC encryption for secure API communication
- **OneBigPie Integration**: Header-based authentication for user/voucher management

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM (`DatabaseStorage` implementation)
- **User Table**: Stores registered users with UUID primary keys

### Project Structure
```
├── client/           # Simple landing page directing to API docs
├── server/           # Express backend
│   ├── routes.ts     # Authentication API endpoints
│   ├── storage.ts    # Data access layer
│   ├── swagger.ts    # API documentation config
│   ├── onecard/      # OneCard Nigeria API integration
│   │   ├── encryption.ts  # AES encryption utilities
│   │   ├── client.ts      # OneCard API client
│   │   └── routes.ts      # OneCard API endpoints
│   └── onebigpie/    # OneBigPie API integration
│       ├── client.ts      # OneBigPie API client
│       └── routes.ts      # OneBigPie API endpoints
├── shared/           # Shared code
│   └── schema.ts     # Database schema and validation
└── migrations/       # Drizzle database migrations
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration with firstName, lastName, universityName, matriculationNumber (optional), phoneNumber, email, password
- `POST /api/auth/login` - User authentication with email and password
- `POST /api/auth/forgot-password` - Password reset request (returns reset token)
- `POST /api/auth/reset-password` - Password reset with token
- `POST /api/auth/change-password` - Authenticated password change (requires Bearer token)
- `GET /api/auth/me` - Get current user (authenticated, requires Bearer token)
- `POST /api/auth/logout` - Logout current user (requires Bearer token)

#### OneCard Nigeria Integration
- `POST /api/onecard/login` - Authenticate with OneCard API (uses stored credentials)
- `POST /api/onecard/logout` - End OneCard session
- `GET /api/onecard/balance` - Get wallet balance
- `GET /api/onecard/services` - Get available services (Mobile, Data, Electricity, Cable TV, etc.)
- `GET /api/onecard/products` - Get products/operators (optional: ?service_id=1)
- `GET /api/onecard/products/:productId/items` - Get product denominations
- `GET /api/onecard/products/:productId/params` - Get product parameters
- `GET /api/onecard/commissions` - Get commission rates
- `POST /api/onecard/recharge` - Perform airtime/data recharge
- `POST /api/onecard/bill/fetch` - Fetch bill information
- `POST /api/onecard/bill/pay` - Pay bills (electricity, cable TV)
- `GET /api/onecard/transactions` - Get transaction history

#### OneBigPie Integration
- `POST /api/onebigpie/users` - Create a new user
- `GET /api/onebigpie/users` - Fetch all users
- `POST /api/onebigpie/subscribe` - Subscribe a user with a voucher
- `GET /api/onebigpie/subscribed-users` - Fetch all subscribed users
- `POST /api/onebigpie/vouchers/generate` - Generate vouchers
- `GET /api/onebigpie/vouchers` - Fetch all vouchers

#### Documentation
- `GET /api-docs` - Swagger UI documentation
- `GET /api/swagger.json` - OpenAPI JSON specification

### OneCard Integration Details

#### Required Secrets
- `ONECARD_API_USERNAME` - API username from OneCard console
- `ONECARD_API_PASSWORD` - API password from OneCard console

#### Encryption Flow
1. Login credentials are encrypted using AES-128-CBC with default key and salt
2. Upon successful login, OneCard returns USER_TOKEN and AUTH_TOKEN
3. AUTH_TOKEN is decrypted to extract new salt for subsequent requests
4. All subsequent request parameters are encrypted with USER_TOKEN (as key) and new salt (as IV)

#### Important Notes
- IP address must be whitelisted in OneCard console at https://agent.onecardnigeria.com
- Session tokens expire after a period defined by OneCard API
- Session management is automatic - endpoints will re-login if session expires

### OneBigPie Integration Details

#### API Configuration
- **Base URL**: https://myshelta.com/testapps/api/onebigpie
- **Authentication**: Header-based with fixed key `MYSHELTA: MYSHELTAONEBIGPIEACCESS`

#### Services
- User creation and management
- Voucher generation and tracking
- Subscription management with vouchers

### Build Process
- Development: Vite dev server with Express middleware
- Production: esbuild bundles server, Vite builds client to `dist/public`

## External Dependencies

### OneCard Nigeria API
- **Base URL**: https://api.onecardnigeria.com/rest
- **Services**: Mobile top-ups, Data bundles, Electricity bills, Cable TV subscriptions, E-vouchers
- **Documentation**: https://documenter.getpostman.com/view/7980428/UVsQsiii

### OneBigPie API
- **Base URL**: https://myshelta.com/testapps/api/onebigpie
- **Services**: User management, Voucher subscriptions
- **Documentation**: https://documenter.getpostman.com/view/12000186/2sBXVmf8xJ

### Authentication & Security
- **bcryptjs**: Password hashing
- **crypto**: Node.js built-in for AES encryption

### API Documentation
- **swagger-jsdoc**: Generate OpenAPI specs from JSDoc comments
- **swagger-ui-express**: Serve interactive API documentation
