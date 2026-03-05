# Authentication & Payment APIs

## Overview

A backend-only REST API application built with Express.js providing user authentication and integration with OneCard Nigeria API for payment/recharge services and OneBigPie API for user management and voucher subscriptions. The system includes user registration, login, password management, and Swagger API documentation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Documentation**: Swagger UI with swagger-jsdoc for auto-generated OpenAPI docs
- **Authentication**: JWT Bearer token authentication (stateless, serverless-friendly)
- **Password Security**: bcryptjs for password hashing
- **Validation**: Zod schemas shared between client and server
- **OneCard Integration**: AES-256-CBC encryption for secure API communication
- **OneBigPie Integration**: Header-based authentication for user/voucher management
- **Paystack Integration**: Payment gateway for wallet funding (card, bank, USSD, bank transfer)
- **Wallet System**: PostgreSQL-backed wallet with balance tracking and transaction history

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM (`DatabaseStorage` implementation)
- **User Table**: Stores registered users with UUID primary keys
- **Wallets Table**: One wallet per user, tracks balance
- **Wallet Transactions Table**: Records all credits/debits with references and status

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
│   ├── onebigpie/    # OneBigPie API integration
│   │   ├── client.ts      # OneBigPie API client
│   │   └── routes.ts      # OneBigPie API endpoints
│   └── paystack/     # Paystack + Wallet integration
│       ├── client.ts      # Paystack API client
│       └── routes.ts      # Wallet API endpoints
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

#### Wallet (Paystack)
- `GET /api/wallet/balance` - Get wallet balance (authenticated)
- `POST /api/wallet/fund` - Initialize wallet funding via Paystack (authenticated)
- `GET /api/wallet/verify/:reference` - Verify payment and credit wallet (authenticated)
- `POST /api/wallet/deduct` - Deduct from wallet balance (authenticated)
- `GET /api/wallet/transactions` - Get wallet transaction history (authenticated)
- `POST /api/wallet/webhook` - Paystack webhook for automatic payment confirmation (public)
- `POST /api/wallet/account` - Create a dedicated bank account number for the user (authenticated)
- `GET /api/wallet/account` - Get user's dedicated bank account details (authenticated)
- `GET /api/wallet/providers` - List available bank providers for dedicated accounts (authenticated)

#### Documentation
- `GET /api-docs` - Swagger UI documentation
- `GET /api/swagger.json` - OpenAPI JSON specification

### OneCard Integration Details

#### Required Secrets
- `JWT_SECRET` - secret used to sign/verify auth tokens
- `ONECARD_API_USERNAME` - API username from OneCard console
- `ONECARD_API_PASSWORD` - API password from OneCard console

#### Encryption Flow
1. Login credentials are encrypted using AES-256-CBC with default key (padded to 32 bytes) and default salt (16 bytes IV)
2. Upon successful login, OneCard returns USER_TOKEN and AUTH_TOKEN
3. AUTH_TOKEN is decrypted using USER_TOKEN as key and default salt as IV (AES-256-CBC)
4. Decrypted AUTH_TOKEN is split by "~" - second part becomes the NEW SALT for subsequent requests
5. All subsequent request parameters are encrypted with USER_TOKEN (as key, padded to 32 bytes) and new salt (as IV)
6. All subsequent API responses are also encrypted and must be decrypted with USER_TOKEN and new salt

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

### Paystack Integration Details

#### Required Secrets
- `PAYSTACK_SECRET_KEY` - Paystack secret key from Dashboard > Settings > API Keys

#### Wallet Funding Flow
1. User calls `POST /api/wallet/fund` with amount in Naira (minimum 100)
2. Backend initializes Paystack transaction and returns `authorizationUrl`
3. User is redirected to Paystack checkout to complete payment
4. Payment confirmed via webhook (`POST /api/wallet/webhook`) or manual verification (`GET /api/wallet/verify/:reference`)
5. Wallet balance is credited upon successful payment

#### Wallet Security
- Atomic wallet crediting via `atomicCreditWallet` prevents double-credits using DB transactions
- Transaction status must be "pending" before crediting (prevents replay attacks)
- Amount validation: paid amount must match stored transaction amount
- Webhook signature verification using HMAC SHA-512
- Conditional auth middleware: webhook endpoint is public, all other wallet endpoints require Bearer token

#### Dedicated Virtual Accounts (DVA)
- Each user can request a permanent bank account number via `POST /api/wallet/account`
- Paystack customer is auto-created if not existing
- Transfers to DVA account automatically credit the user's wallet via webhook
- DVA creation is async - webhook `dedicatedaccount.assign.success` stores account details
- Bank transfer payments via DVA arrive as `charge.success` webhook with `channel: "dedicated_nuban"`
- Requires DVA feature to be enabled on the Paystack business account
- Supported banks: Wema Bank, Paystack-Titan (use "test-bank" in test mode)
- Database tables: `paystack_customers` (stores customer codes), `dedicated_accounts` (stores account details)

#### User Linking
- OneBigPie users are linked to main auth users via email matching
- During registration, a corresponding OneBigPie user is auto-created
- Login and /auth/me responses include the linked OneBigPie user data

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
