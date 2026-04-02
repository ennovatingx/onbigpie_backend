import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { storage } from "../storage.ts";
import { fundWalletSchema, deductWalletSchema } from "../../shared/schema.ts";
import { initializeTransaction, verifyTransaction, verifyWebhookSignature, createPaystackCustomer, fetchPaystackCustomer, fetchCustomerTransactions, createDedicatedAccount, listAvailableProviders } from "./client.ts";

const router = Router();

/**
 * @swagger
 * /wallet/customer/{emailOrCode}:
 *   get:
 *     summary: Fetch Paystack customer by email or customer code
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: emailOrCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Paystack customer email or customer code
 *     responses:
 *       200:
 *         description: Customer retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FetchPaystackCustomerResponse'
 *       400:
 *         description: Missing path parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/customer/:emailOrCode", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const emailOrCode = String(req.params.emailOrCode ?? "").trim();
    if (!emailOrCode) {
      return res.status(400).json({ error: "emailOrCode is required" });
    }

    const result = await fetchPaystackCustomer(emailOrCode);
    return res.json(result);
  } catch (error) {
    console.error("Fetch Paystack customer error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/customer/{customerId}/transactions:
 *   get:
 *     summary: Fetch Paystack transactions for a specific customer
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Paystack customer numeric ID
 *     responses:
 *       200:
 *         description: Customer transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FetchCustomerTransactionsResponse'
 *       400:
 *         description: Invalid customerId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/customer/:customerId/transactions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const customerIdRaw = String(req.params.customerId ?? "").trim();
    const customerId = Number(customerIdRaw);
    if (!customerIdRaw || Number.isNaN(customerId) || customerId <= 0) {
      return res.status(400).json({ error: "customerId must be a positive number" });
    }

    const result = await fetchCustomerTransactions(customerId);
    return res.json(result);
  } catch (error) {
    console.error("Fetch customer transactions error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletBalanceResponse'
 *       401:
 *         description: Unauthorized
 */
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const wallet = await storage.getOrCreateWallet(userId);
    res.json({
      balance: wallet.balance,
      updatedAt: wallet.updatedAt,
    });
  } catch (error) {
    console.error("Wallet balance error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/fund:
 *   post:
 *     summary: Initialize wallet funding via Paystack
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FundWalletRequest'
 *     responses:
 *       200:
 *         description: Paystack payment URL generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FundWalletResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/fund", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const validationResult = fundWalletSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const { amount, callbackUrl } = validationResult.data;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const wallet = await storage.getOrCreateWallet(userId);
    const reference = `WF-${randomUUID()}`;
    const amountInKobo = Math.round(amount * 100);

    const paystackResult = await initializeTransaction(
      user.email,
      amountInKobo,
      reference,
      callbackUrl,
      { userId, walletId: wallet.id, type: "wallet_funding" },
    );

    await storage.createWalletTransaction({
      walletId: wallet.id,
      userId,
      type: "credit",
      amount: amount.toFixed(2),
      reference,
      status: "pending",
      description: "Wallet funding via Paystack",
      metadata: JSON.stringify({ paystack_access_code: paystackResult.data.access_code }),
    });

    res.json({
      message: "Payment initialized",
      reference,
      authorizationUrl: paystackResult.data.authorization_url,
      accessCode: paystackResult.data.access_code,
    });
  } catch (error) {
    console.error("Fund wallet error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/verify/{reference}:
 *   get:
 *     summary: Verify a wallet funding payment
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment reference from fund endpoint
 *     responses:
 *       200:
 *         description: Payment verification result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyPaymentResponse'
 *       400:
 *         description: Invalid reference or already processed
 *       401:
 *         description: Unauthorized
 */
router.get("/verify/:reference", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const reference = req.params.reference as string;

    const existingTx = await storage.getWalletTransactionByReference(reference);
    if (!existingTx) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (existingTx.userId !== userId) {
      return res.status(403).json({ error: "Not your transaction" });
    }
    if (existingTx.status === "success") {
      const wallet = await storage.getWalletByUserId(userId);
      return res.json({
        message: "Payment already verified and credited",
        status: "success",
        balance: wallet?.balance || "0.00",
      });
    }

    if (existingTx.status !== "pending") {
      return res.status(400).json({ error: `Transaction already ${existingTx.status}` });
    }

    const paystackResult = await verifyTransaction(reference);

    if (paystackResult.data.status === "success") {
      const paidAmountNaira = (paystackResult.data.amount / 100).toFixed(2);
      const expectedAmount = existingTx.amount;

      if (paidAmountNaira !== expectedAmount) {
        await storage.updateWalletTransactionStatus(reference, "failed");
        return res.status(400).json({
          error: "Amount mismatch",
          expected: expectedAmount,
          received: paidAmountNaira,
        });
      }

      const result = await storage.atomicCreditWallet(reference, userId, paidAmountNaira);
      if (!result) {
        return res.json({
          message: "Payment already processed",
          status: "success",
        });
      }

      res.json({
        message: "Payment verified and wallet credited",
        status: "success",
        amountCredited: paidAmountNaira,
        balance: result.wallet.balance,
      });
    } else {
      await storage.updateWalletTransactionStatus(reference, paystackResult.data.status);
      res.json({
        message: `Payment ${paystackResult.data.status}`,
        status: paystackResult.data.status,
        gatewayResponse: paystackResult.data.gateway_response,
      });
    }
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/webhook:
 *   post:
 *     summary: Paystack webhook for automatic payment confirmation
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-paystack-signature"] as string;
    const rawBody = (req as any).rawBody;

    if (!signature) {
      console.warn("Webhook missing signature header");
      return res.status(401).json({ error: "Invalid signature" });
    }

    if (!rawBody) {
      console.warn("Webhook missing raw body");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const rawBodyString = typeof rawBody === "string" ? rawBody : rawBody.toString();
    if (!verifyWebhookSignature(rawBodyString, signature)) {
      console.warn("Webhook signature verification failed");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const { reference, amount } = event.data;

      const existingTx = await storage.getWalletTransactionByReference(reference);
      if (existingTx && existingTx.status === "pending") {
        const paidAmountNaira = (amount / 100).toFixed(2);
        if (paidAmountNaira !== existingTx.amount) {
          console.error(`Webhook amount mismatch for ${reference}: expected ${existingTx.amount}, got ${paidAmountNaira}`);
          await storage.updateWalletTransactionStatus(reference, "failed");
        } else {
          await storage.atomicCreditWallet(reference, existingTx.userId, paidAmountNaira);
        }
      } else if (!existingTx && event.data.channel === "dedicated_nuban") {
        const chargeId = event.data.id;
        if (!chargeId) {
          console.error("DVA webhook missing charge id");
          return res.sendStatus(200);
        }

        const dvaRef = `DVA-${chargeId}`;
        const dupCheck = await storage.getWalletTransactionByReference(dvaRef);
        if (dupCheck) {
          return res.sendStatus(200);
        }

        let userId: string | undefined;

        // Try to find user by customer code first
        const customerCode = event.data.customer?.customer_code;
        if (customerCode) {
          const paystackCust = await storage.getPaystackCustomerByCustomerCode(customerCode);
          if (paystackCust) userId = paystackCust.userId;
        }

        // If not found by customer code, try to find by account number
        if (!userId) {
          const accountNumber = event.data.account_number || event.data.metadata?.account_number;
          if (accountNumber) {
            const dedicatedAccount = await storage.getDedicatedAccountByAccountNumber(accountNumber);
            if (dedicatedAccount) userId = dedicatedAccount.userId;
          }
        }

        if (userId) {
          const amountNaira = (amount / 100).toFixed(2);
          const wallet = await storage.getOrCreateWallet(userId);

          await storage.createWalletTransaction({
            walletId: wallet.id,
            userId,
            type: "credit",
            amount: amountNaira,
            reference: dvaRef,
            status: "success",
            description: "Wallet funding via bank transfer (DVA)",
            metadata: JSON.stringify({ paystack_charge_id: chargeId, paystack_reference: reference, channel: "dedicated_nuban", matched_by: "account_number" }),
          });

          await storage.atomicCreditWallet(dvaRef, userId, amountNaira);
          console.log(`[DVA] Credited wallet for user ${userId}, amount: ${amountNaira}, reference: ${dvaRef}`);
        } else {
          console.warn(`[DVA Webhook] Could not match to user. Charge ID: ${chargeId}, Amount: ${amount}, Event:`, JSON.stringify(event.data));
        }
      }
    }

    if (event.event === "dedicatedaccount.assign.success") {
      const data = event.data;
      const customerCode = data.customer?.customer_code;
      if (customerCode && data.dedicated_account) {
        const paystackCustomer = await storage.getPaystackCustomerByCustomerCode(customerCode);
        if (paystackCustomer) {
          const existingAccount = await storage.getDedicatedAccountByUserId(paystackCustomer.userId);
          if (existingAccount) {
            await storage.updateDedicatedAccount(paystackCustomer.userId, {
              bankName: data.dedicated_account.bank?.name || existingAccount.bankName,
              accountName: data.dedicated_account.account_name || existingAccount.accountName,
              accountNumber: data.dedicated_account.account_number || existingAccount.accountNumber,
              bankId: data.dedicated_account.bank?.id || existingAccount.bankId,
              active: 1,
              assignedAt: data.dedicated_account.assignment?.assigned_at ? new Date(data.dedicated_account.assignment.assigned_at) : new Date(),
            });
          } else {
            await storage.createDedicatedAccount({
              userId: paystackCustomer.userId,
              customerCode,
              bankName: data.dedicated_account.bank?.name || "Unknown",
              accountName: data.dedicated_account.account_name || "Unknown",
              accountNumber: data.dedicated_account.account_number || "Unknown",
              bankId: data.dedicated_account.bank?.id,
              assignedAt: data.dedicated_account.assignment?.assigned_at ? new Date(data.dedicated_account.assignment.assigned_at) : new Date(),
            });
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(200);
  }
});

/**
 * @swagger
 * /wallet/deduct:
 *   post:
 *     summary: Deduct from wallet balance
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeductWalletRequest'
 *     responses:
 *       200:
 *         description: Deduction successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeductWalletResponse'
 *       400:
 *         description: Insufficient balance or validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/deduct", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const validationResult = deductWalletSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const { amount, description, reference: customRef } = validationResult.data;
    const wallet = await storage.getOrCreateWallet(userId);

    if (parseFloat(wallet.balance) < amount) {
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    const reference = customRef || `WD-${randomUUID()}`;

    const existingTx = await storage.getWalletTransactionByReference(reference);
    if (existingTx) {
      return res.status(400).json({ error: "Duplicate reference" });
    }

    await storage.createWalletTransaction({
      walletId: wallet.id,
      userId,
      type: "debit",
      amount: amount.toFixed(2),
      reference,
      status: "success",
      description,
    });

    const updatedWallet = await storage.debitWallet(userId, amount.toFixed(2));

    res.json({
      message: "Deduction successful",
      reference,
      amountDeducted: amount.toFixed(2),
      balance: updatedWallet.balance,
    });
  } catch (error) {
    console.error("Deduct wallet error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/transactions:
 *   get:
 *     summary: Get wallet transaction history
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletTransactionsResponse'
 *       401:
 *         description: Unauthorized
 */
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const transactions = await storage.getWalletTransactions(userId);
    res.json({ transactions });
  } catch (error) {
    console.error("Wallet transactions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/account:
 *   post:
 *     summary: Create a dedicated bank account number for the user
 *     description: Creates a Paystack customer (if needed) and assigns a dedicated virtual account number. The user can fund their wallet by transferring to this account.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferredBank:
 *                 type: string
 *                 description: Bank slug (e.g. "wema-bank", "titan-paystack", or "test-bank" for test mode)
 *                 example: "test-bank"
 *     responses:
 *       200:
 *         description: Dedicated account created or already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 accountNumber:
 *                   type: string
 *                 accountName:
 *                   type: string
 *                 bankName:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/account", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const existingAccount = await storage.getDedicatedAccountByUserId(userId);
    if (existingAccount) {
      return res.json({
        message: "Dedicated account already exists",
        accountNumber: existingAccount.accountNumber,
        accountName: existingAccount.accountName,
        bankName: existingAccount.bankName,
      });
    }

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    let paystackCustomer = await storage.getPaystackCustomerByUserId(userId);
    if (!paystackCustomer) {
      const customerResult = await createPaystackCustomer(
        user.email,
        user.firstName,
        user.lastName,
        user.phoneNumber,
      );
      paystackCustomer = await storage.createPaystackCustomer({
        userId,
        customerCode: customerResult.data.customer_code,
        paystackCustomerId: customerResult.data.id,
      });
    }

    const preferredBank = req.body?.preferredBank || undefined;
    let dvaResult;
    try {
      dvaResult = await createDedicatedAccount(paystackCustomer.customerCode, preferredBank);
    } catch (error: any) {
      if (error.message?.includes("not available for your business")) {
        return res.status(400).json({ error: "Dedicated Virtual Accounts are not enabled for your Paystack business. Please contact Paystack support to activate this feature." });
      }
      throw error;
    }

    if (dvaResult.data.assigned && dvaResult.data.account_number) {
      const dedicatedAccount = await storage.createDedicatedAccount({
        userId,
        customerCode: paystackCustomer.customerCode,
        bankName: dvaResult.data.bank.name,
        accountName: dvaResult.data.account_name,
        accountNumber: dvaResult.data.account_number,
        bankId: dvaResult.data.bank.id,
        assignedAt: dvaResult.data.assignment?.assigned_at ? new Date(dvaResult.data.assignment.assigned_at) : undefined,
      });

      await storage.getOrCreateWallet(userId);

      res.json({
        message: "Dedicated account created successfully",
        accountNumber: dedicatedAccount.accountNumber,
        accountName: dedicatedAccount.accountName,
        bankName: dedicatedAccount.bankName,
      });
    } else {
      await storage.createDedicatedAccount({
        userId,
        customerCode: paystackCustomer.customerCode,
        bankName: "Pending",
        accountName: "Pending",
        accountNumber: `pending-${randomUUID().slice(0, 8)}`,
        active: 0,
      });

      await storage.getOrCreateWallet(userId);

      res.json({
        message: "Dedicated account request submitted. The account number will be assigned shortly. Check back using GET /api/wallet/account.",
        status: "pending",
      });
    }
  } catch (error: any) {
    console.error("Create dedicated account error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/account:
 *   get:
 *     summary: Get user's dedicated bank account details
 *     description: Returns the dedicated virtual account number assigned to the user for wallet funding via bank transfer.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accountNumber:
 *                   type: string
 *                 accountName:
 *                   type: string
 *                 bankName:
 *                   type: string
 *                 active:
 *                   type: boolean
 *       404:
 *         description: No dedicated account found
 *       401:
 *         description: Unauthorized
 */
router.get("/account", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const account = await storage.getDedicatedAccountByUserId(userId);
    if (!account) {
      return res.status(404).json({
        error: "No dedicated account found. Create one using POST /api/wallet/account",
      });
    }

    if (account.active === 0) {
      return res.json({
        status: "pending",
        message: "Your dedicated account is being set up. Please check back shortly.",
      });
    }

    res.json({
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
      active: true,
    });
  } catch (error) {
    console.error("Get dedicated account error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/providers:
 *   get:
 *     summary: List available bank providers for dedicated accounts
 *     description: Returns the list of banks available for creating dedicated virtual accounts.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Providers list retrieved
 *       401:
 *         description: Unauthorized
 */
router.get("/providers", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const providers = await listAvailableProviders();
    res.json(providers);
  } catch (error: any) {
    console.error("List providers error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/debug/account-lookup:
 *   post:
 *     summary: Debug endpoint - lookup user by account number
 *     description: Find which user owns a dedicated account by account number. Helps track incoming transfers. This endpoint is public (no auth required).
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accountNumber:
 *                 type: string
 *                 example: "9755046603"
 *     responses:
 *       200:
 *         description: Account owner found
 *       404:
 *         description: Account not found
 */
router.post("/debug/account-lookup", async (req: Request, res: Response) => {
  try {
    const { accountNumber } = req.body;
    if (!accountNumber) {
      return res.status(400).json({ error: "accountNumber is required" });
    }

    const account = await storage.getDedicatedAccountByAccountNumber(accountNumber);
    if (!account) {
      return res.status(404).json({ error: "Account not found", accountNumber });
    }

    const user = await storage.getUser(account.userId);
    const wallet = await storage.getWalletByUserId(account.userId);
    const transactions = await storage.getWalletTransactions(account.userId);

    res.json({
      account: {
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        bankName: account.bankName,
        active: account.active === 1,
        createdAt: account.createdAt,
      },
      user: {
        id: user?.id,
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
      },
      wallet: {
        balance: wallet?.balance || "0.00",
        updatedAt: wallet?.updatedAt,
      },
      recentTransactions: transactions.slice(0, 10),
    });
  } catch (error) {
    console.error("Account lookup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /wallet/public/{email}:
 *   get:
 *     summary: Fetch user wallet by email (Public)
 *     description: Get wallet balance and details using only email address. No authentication required.
 *     tags: [Wallet]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: User email address
 *         example: "user@example.com"
 *     responses:
 *       200:
 *         description: Wallet details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                 wallet:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *       404:
 *         description: User or wallet not found
 *       400:
 *         description: Invalid email format
 */
router.get("/public/:email", async (req: Request, res: Response) => {
  try {
    const email = String(req.params.email ?? "").trim();
    
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email address is required" });
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found", email });
    }

    const wallet = await storage.getWalletByUserId(user.id);
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found for user", email });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      wallet: {
        balance: wallet.balance,
        currency: "NGN",
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (error) {
    console.error("Fetch wallet by email error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
