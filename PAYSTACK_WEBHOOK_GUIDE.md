# Paystack Webhook Integration Guide

## Overview

The wallet system uses Paystack webhooks to automatically credit user wallets when payments are received. Two main payment channels are supported:

1. **Online Payments** - Direct card/bank payments via Paystack checkout
2. **Bank Transfers** - Via Dedicated Virtual Account (DVA)

---

## Security: Webhook Signature Verification

All incoming webhooks are verified using **HMAC-SHA512** with your Paystack secret key to ensure authenticity.

### Verification Process
```typescript
// The signature is verified before processing any webhook
function verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", getSecretKey())
    .update(body)
    .digest("hex");
  return hash === signature;
}
```

**Requirements:**
- Raw request body must be preserved (not parsed into JSON first)
- Signature header: `x-paystack-signature`
- Both are already configured in `server/app.ts`

---

## Environment Setup

### Required Environment Variables

```env
# Paystack API Configuration
PAYSTACK_SECRET_KEY=sk_live_xxxxxxx (or sk_test_xxxxxxx for testing)
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxx (or pk_test_xxxxxxx for testing)
```

### Database Setup

Ensure the following tables exist:
- `wallets` - stores user wallet balances
- `wallet_transactions` - stores transaction history
- `dedicated_accounts` - stores DVA information for users

---

## How Webhooks Work

### 1. Online Payment Flow

```
User initiates wallet funding
    ↓
    → Client calls POST /wallet/fund (creates pending transaction)
    ↓
    → Paystack checkout opens
    ↓
    → User completes payment
    ↓
    → Paystack sends "charge.success" webhook
    ↓
    → Server verifies signature
    ↓
    → Server credits wallet (atomically updates balance + transaction status)
    ↓
    → User sees updated balance
```

**Webhook Event:** `charge.success`

**Processing:**
```typescript
if (event.event === "charge.success") {
  const { reference, amount } = event.data;
  
  // Find existing pending transaction
  const existingTx = await storage.getWalletTransactionByReference(reference);
  
  if (existingTx && existingTx.status === "pending") {
    // Verify amount matches
    const paidAmountNaira = (amount / 100).toFixed(2);
    
    if (paidAmountNaira === existingTx.amount) {
      // Credit wallet atomically
      await storage.atomicCreditWallet(reference, existingTx.userId, paidAmountNaira);
    } else {
      // Mark as failed due to amount mismatch
      await storage.updateWalletTransactionStatus(reference, "failed");
    }
  }
}
```

### 2. Bank Transfer Flow (Dedicated Virtual Account)

```
Admin creates dedicated account for user
    ↓
    → Paystack sends "dedicatedaccount.assign.success" webhook
    ↓
    → Server stores account details (bank, account number, customer code)
    ↓
    → User transfers money to their dedicated account
    ↓
    → Paystack sends "charge.success" webhook
    ↓
    → Server matches transfer to user by:
       a) Customer code (primary)
       b) Account number (fallback)
    ↓
    → Server credits wallet
```

**Webhook Events:**
- `dedicatedaccount.assign.success` - Account created/assigned
- `charge.success` - Payment received via DVA

**Processing:**

```typescript
// Handle account assignment
if (event.event === "dedicatedaccount.assign.success") {
  const { customer, dedicated_account } = event.data;
  
  // Find user by customer code
  const paystackCustomer = await storage.getPaystackCustomerByCustomerCode(
    customer.customer_code
  );
  
  if (paystackCustomer) {
    // Store or update dedicated account details
    await storage.createDedicatedAccount({
      userId: paystackCustomer.userId,
      customerCode: customer.customer_code,
      bankName: dedicated_account.bank.name,
      accountName: dedicated_account.account_name,
      accountNumber: dedicated_account.account_number,
      bankId: dedicated_account.bank.id,
      assignedAt: new Date(dedicated_account.assignment.assigned_at),
    });
  }
}

// Handle incoming transfer
if (event.event === "charge.success" && channel === "dedicated_nuban") {
  const { id: chargeId, amount, customer, account_number } = event.data;
  
  // Try to find user by customer code
  let userId = null;
  if (customer?.customer_code) {
    const paystackCust = await storage.getPaystackCustomerByCustomerCode(
      customer.customer_code
    );
    if (paystackCust) userId = paystackCust.userId;
  }
  
  // Fallback: find by account number
  if (!userId && account_number) {
    const dedicatedAccount = await storage.getDedicatedAccountByAccountNumber(
      account_number
    );
    if (dedicatedAccount) userId = dedicatedAccount.userId;
  }
  
  if (userId) {
    // Credit wallet
    const amountNaira = (amount / 100).toFixed(2);
    await storage.atomicCreditWallet(
      `DVA-${chargeId}`,
      userId,
      amountNaira
    );
  }
}
```

---

## Configuration in Paystack Dashboard

### Step 1: Enable Webhooks
1. Go to **Settings → API Keys & Webhooks**
2. Find **Webhooks** section
3. Set **Webhook URL** to: `https://yourdomain.com/api/wallet/webhook`
4. Copy your **Secret Key** set `PAYSTACK_SECRET_KEY` environment variable

### Step 2: Enable Webhook Events
Ensure these events are enabled:
- ✅ **charge.success** - Payment received
- ✅ **dedicatedaccount.assign.success** - DVA assigned

### Step 3: Test Webhook
Use Paystack's test webhook feature in the dashboard to send test events.

---

## API Endpoints

### Initiate Wallet Funding
**Endpoint:** `POST /wallet/fund`
```json
{
  "amount": 1000,
  "callbackUrl": "https://yourdomain.com/wallet/success"
}
```

**Response:**
```json
{
  "message": "Payment initialized",
  "reference": "WF-1704067200000",
  "authorizationUrl": "https://checkout.paystack.com/...",
  "accessCode": "..."
}
```

**What Happens:**
1. Creates a pending wallet transaction
2. Initializes payment with Paystack
3. Returns checkout URL
4. Webhook will credit wallet when payment completes

### Verify Payment (Optional)
**Endpoint:** `GET /wallet/verify/:reference`

Use this to manually verify a payment (useful for client-side confirmation):
```json
{
  "message": "Payment verified",
  "status": "success",
  "amountCredited": "1000.00",
  "balance": "5000.00"
}
```

### Get Wallet Balance
**Endpoint:** `GET /wallet/balance`

Returns current wallet balance.

### Create Dedicated Account
**Endpoint:** `POST /wallet/account`

Assigns a dedicated virtual account to the user for bank transfers:
```json
{
  "preferredBank": "wema-bank"
}
```

---

## Testing Webhooks Locally

### Option 1: Using ngrok Tunnel

```bash
# 1. Install ngrok
brew install ngrok

# 2. Start ngrok tunnel
ngrok http 5000

# 3. Update Paystack webhook URL in dashboard:
# https://xxxxx.ngrok.io/api/wallet/webhook

# 4. Keep ngrok running while developing
```

### Option 2: Using Postman

1. **Create a Mock Request:**
```bash
POST http://localhost:5000/api/wallet/webhook

Headers:
{
  "x-paystack-signature": "your_calculated_signature",
  "Content-Type": "application/json"
}

Body:
{
  "event": "charge.success",
  "data": {
    "id": 123456,
    "reference": "WF-1704067200000",
    "amount": 100000,
    "status": "success",
    "channel": "card",
    "customer": {
      "customer_code": "CUS_xxxxx"
    }
  }
}
```

2. **Calculate Signature (Node.js)**
```javascript
const crypto = require('crypto');

const body = JSON.stringify(event);
const signature = crypto
  .createHmac('sha512', 'your_paystack_secret_key')
  .update(body)
  .digest('hex');

console.log('x-paystack-signature:', signature);
```

### Option 3: Paystack Test Events
Paystack dashboard has a built-in webhook tester:
1. Go to **Settings → API Keys & Webhooks**
2. Click **Send Test Event** button
3. Select event type and review the webhook on your server

---

## Transaction Flow & Idempotency

### Atomic Wallet Credit
The system uses atomic transactions to ensure:
- Wallet balance updates
- Transaction status changes to "success"
- Both happen together or neither happens

**Function:** `atomicCreditWallet(reference, userId, amount)`

### Duplicate Prevention
- Each transaction has a unique `reference` identifier
- DVA transfers use format: `DVA-{chargeId}` to avoid duplicates
- Before crediting, system checks for existing transaction with same reference

---

## Debugging & Monitoring

### Log Webhook Events
Check your server logs for webhook processing:
```
[Webhook] Processing charge.success for reference: WF-1704067200000
[Webhook] Credited wallet for user: 96fd5731-994f-4686-b9ba-1f299ad2a7c0
[Webhook] Amount: 1000.00
```

### View Transaction History
**Endpoint:** `GET /wallet/transactions`

Returns all wallet transactions with status (pending/success/failed).

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Raw body is null | Express middleware ordering | Ensure `express.json({ verify: ... })` is set up in app.ts |
| Signature verification fails | Wrong secret key | Verify `PAYSTACK_SECRET_KEY` env var |
| Wallet not credited | Reference not found | Check wallet transaction was created before payment |
| DVA user not matched | Missing account data | Ensure dedicated account is created before transfer |
| Duplicate credits | Webhook retried | Reference check should prevent duplicates |

---

## Production Checklist

- [ ] Set `PAYSTACK_SECRET_KEY` to live secret key (starts with `sk_live_`)
- [ ] Set `PAYSTACK_PUBLIC_KEY` to live public key (starts with `pk_live_`)
- [ ] Update Paystack webhook URL to production domain
- [ ] Test end-to-end payment flow (fund wallet → pay → webhook → credit)
- [ ] Monitor webhook logs for errors
- [ ] Set up alerts for webhook failures
- [ ] Test DVA transfer workflow if using bank transfers
- [ ] Enable automatic webhook retries in Paystack dashboard

---

## Architecture Diagram

```
┌─────────────────────┐
│   Client/Frontend   │
└──────────┬──────────┘
           │
           │ POST /wallet/fund
           ↓
┌─────────────────────────────────┐
│  Backend - Wallet Routes        │
│  - Create transaction (pending) │
│  - Initialize Paystack payment  │
└──────────┬─────────────────────┘
           │
           │ Return checkout URL
           ↓
┌─────────────────────┐
│  Paystack Checkout  │
│  (User pays)        │
└──────────┬──────────┘
           │
           │ Send webhook (charge.success)
           ↓
┌────────────────────────────────┐
│  Backend - Webhook Handler     │
│  1. Verify signature (HMAC)    │
│  2. Find transaction by ref    │
│  3. Verify amount matches      │
│  4. Atomic credit wallet       │
└────────┬─────────────────────┘
         │
         ↓
┌────────────────────────┐
│  Database Updates      │
│  - Wallet balance ++   │
│  - Transaction success │
└────────────────────────┘
```

---

## References

- [Paystack Webhook Documentation](https://paystack.com/docs/payments/webhooks/)
- [Paystack API Reference](https://paystack.com/docs/api/)
- [HMAC-SHA512 Signature](https://paystack.com/docs/payments/webhooks/#verify-signature)
