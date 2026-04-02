# 🚀 Paystack Webhook Integration - Quick Start

## What is a Paystack Webhook?

A webhook is an HTTP POST request that Paystack sends to your server whenever a payment event occurs. This allows your app to automatically:
- ✅ Credit user wallets when they complete payment
- ✅ Handle both online payments (card/bank) and bank transfers
- ✅ Update transaction status in real-time
- ✅ Send confirmation emails/notifications

---

## 5-Minute Setup

### 1. Get Your Paystack Keys

1. Go to [Paystack Dashboard](https://dashboard.paystack.com)
2. Click **Settings** → **Developers** → **API Keys**
3. You'll see:
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)
   - **Public Key** (starts with `pk_test_` or `pk_live_`)

### 2. Set Environment Variables

Create a `.env` file in your project root (or update existing one):

```env
# Copy your keys from Paystack Dashboard
PAYSTACK_SECRET_KEY=sk_test_your_actual_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_actual_key_here
```

### 3. Configure Paystack Webhook URL

In Paystack Dashboard:

1. Go to **Settings** → **Developers** → **API Keys & Webhooks**
2. Find the **Webhooks** section
3. Set **Webhook URL** to:
   - **Development (local):** Use [ngrok](https://ngrok.com/) to expose port 5000:
     ```bash
     # Install ngrok
     brew install ngrok
     
     # Start ngrok tunnel to port 5000
     ngrok http 5000
     
     # You'll get: https://xxxxx.ngrok.io
     # Webhook URL: https://xxxxx.ngrok.io/api/wallet/webhook
     ```
   
   - **Production:** `https://yourdomain.com/api/wallet/webhook`

4. Enable these webhook events:
   - ✅ **charge.success** (payment completed)
   - ✅ **charge.failed** (payment failed)
   - ✅ **dedicatedaccount.assign.success** (DVA account created)

5. Save

### 4. Restart Your Server

```bash
yarn dev
# or
npm run dev
```

Your server is now listening for webhooks! 🎉

---

## How It Works

### Online Payment Flow

```
User clicks "Fund Wallet" ($10)
         ↓
Server creates pending transaction (status: "pending", ref: "WF-12345")
         ↓
User redirected to Paystack checkout
         ↓
User enters card/bank details and pays
         ↓
Paystack sends webhook: "charge.success"
         ↓
Your server receives webhook with signature
         ↓
Server verifies signature (using PAYSTACK_SECRET_KEY)
         ↓
Server finds transaction by reference
         ↓
Server checks amount matches ($10 = 1000 kobo)
         ↓
Server updates wallet atomically:
  - Balance: $0 → $10 ✅
  - Transaction status: "pending" → "success" ✅
         ↓
User sees wallet updated! Success! 🎉
```

### Bank Transfer Flow (Optional)

```
Admin creates dedicated account for user
         ↓
Paystack sends "dedicatedaccount.assign.success"
         ↓
Server stores account details:
  - Bank: Wema Bank
  - Account: 9755046603
  - Name: JOHN DOE
         ↓
User transfers $5 to their account
         ↓
Paystack sends webhook: "charge.success" (channel: "dedicated_nuban")
         ↓
Server matches user by account number or customer code
         ↓
Server credits wallet $5
         ↓
User sees wallet updated! 🎉
```

---

## Testing the Webhook

### Option 1: Use Test Script (Easiest)

```bash
# Install dependencies (if not already done)
yarn add node-fetch

# Run test
PAYSTACK_SECRET_KEY=sk_test_your_key node webhook-test.js test-online

# Test all scenarios
PAYSTACK_SECRET_KEY=sk_test_your_key node webhook-test.js test-all
```

### Option 2: Use Paystack's Test Dashboard

1. In Paystack Dashboard → **Settings** → **Developers** → **Webhooks**
2. Click **Send Test Event**
3. Select **charge.success**
4. Check your server logs to confirm webhook was received

### Option 3: Use Postman

1. Create a POST request to `http://localhost:5000/api/wallet/webhook`
2. Add header: `x-paystack-signature: [calculated signature]`
3. Send JSON body with event data
4. Check server logs

---

## Key Concepts

### 1. Signature Verification

Every webhook from Paystack includes an `x-paystack-signature` header. Your server verifies it using your secret key to ensure it's really from Paystack.

```typescript
// Automatically done in your code
const signature = req.headers["x-paystack-signature"];
const isValid = verifyWebhookSignature(rawBody, signature);
```

### 2. Idempotency

Paystack may send the same webhook multiple times (network issues, retries). Your system prevents duplicates using reference IDs:

```
First attempt: Reference "WF-12345" → Credit wallet ✅
Retry: Reference "WF-12345" → Already exists, skip ✅
```

### 3. Atomic Transactions

Wallet credit happens atomically - either both balance + status update, or neither. No half-transactions.

### 4. Two Payment Channels

- **charge.success** - Online payment (needs pre-created transaction)
- **charge.success + dedicated_nuban** - DVA transfer (matched by account number)

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/wallet/fund` | POST | Start wallet funding (returns checkout URL) |
| `/wallet/verify/:reference` | GET | Verify a payment |
| `/wallet/balance` | GET | Get wallet balance |
| `/wallet/webhook` | POST | Receive webhooks (Paystack sends here) |
| `/wallet/account` | POST/GET | Create/view dedicated bank account |

---

## Environment Variables Explained

```env
# Your Paystack secret key - NEVER share this!
# Test key starts with sk_test_
# Live key starts with sk_live_
PAYSTACK_SECRET_KEY=sk_test_abc123...

# Your Paystack public key - safe to use in frontend
# Test key starts with pk_test_
# Live key starts with pk_live_
PAYSTACK_PUBLIC_KEY=pk_test_xyz789...

# Database for storing transactions
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Random string for JWT signing
JWT_SECRET=some-very-long-random-string-min-32-chars

# Server port (default 5000)
PORT=5000
```

---

## Common Issues & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| Webhook not received | Webhook URL not configured | Check Paystack Dashboard > Settings |
| Signature verification failed | Wrong secret key | Verify `PAYSTACK_SECRET_KEY` in `.env` |
| Wallet not credited | Transaction not found | Ensure `/wallet/fund` was called first |
| "Raw body is null" error | Express middleware issue | Check `app.ts` has `express.json({ verify: ... })` |
| Testing locally doesn't work | No public URL | Use ngrok: `ngrok http 5000` |
| Duplicate webhooks | Retry mechanism | Your code handles this with reference check |

---

## Production Checklist

Before going live:

- [ ] Change `PAYSTACK_SECRET_KEY` from `sk_test_` to `sk_live_`
- [ ] Change `PAYSTACK_PUBLIC_KEY` from `pk_test_` to `pk_live_`
- [ ] Update Paystack webhook URL to production domain (`https://yourdomain.com/api/wallet/webhook`)
- [ ] Test a real payment with small amount
- [ ] Monitor webhook logs for errors
- [ ] Set up alerts for failed transactions
- [ ] Verify HTTPS is enabled on production domain
- [ ] Test all payment channels (card, bank, DVA)

---

## Next Steps

1. **Set up keys** → Add to `.env`
2. **Configure webhook URL** → In Paystack Dashboard
3. **Test locally** → Use ngrok + test script
4. **Test payment** → Try a real transaction
5. **Deploy** → To production with live keys
6. **Monitor** → Check logs for any issues

---

## More Information

- 📖 **Detailed Guide:** See `PAYSTACK_WEBHOOK_GUIDE.md`
- 🧪 **Test Helper:** Run `node webhook-test.js help`
- 🔗 **Paystack Docs:** https://paystack.com/docs/payments/webhooks/
- 💰 **Pricing:** https://paystack.com/pricing

---

## Need Help?

Check the logs:
```bash
# Watch server logs in real-time
tail -f server.log

# Or with yarn dev - look for:
# ✅ [Webhook] Processing charge.success
# ❌ [Webhook] Signature verification failed
```

If still stuck, check:
1. Is ngrok running? (for local testing)
2. Is webhook URL correct in Paystack Dashboard?
3. Is `PAYSTACK_SECRET_KEY` set correctly?
4. Are webhook events enabled in Dashboard?
5. Is the endpoint `/api/wallet/webhook` publicly accessible?

