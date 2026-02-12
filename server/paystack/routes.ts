import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { fundWalletSchema, deductWalletSchema } from "@shared/schema";
import { initializeTransaction, verifyTransaction, verifyWebhookSignature, createPaystackCustomer, createDedicatedAccount, listAvailableProviders } from "./client";

const router = Router();

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
    const rawBody = JSON.stringify(req.body);

    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
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

        const customerCode = event.data.customer?.customer_code;
        if (customerCode) {
          const paystackCust = await storage.getPaystackCustomerByCustomerCode(customerCode);
          if (paystackCust) {
            const amountNaira = (amount / 100).toFixed(2);
            const wallet = await storage.getOrCreateWallet(paystackCust.userId);

            await storage.createWalletTransaction({
              walletId: wallet.id,
              userId: paystackCust.userId,
              type: "credit",
              amount: amountNaira,
              reference: dvaRef,
              status: "pending",
              description: "Wallet funding via bank transfer (DVA)",
              metadata: JSON.stringify({ paystack_charge_id: chargeId, paystack_reference: reference, channel: "dedicated_nuban" }),
            });

            await storage.atomicCreditWallet(dvaRef, paystackCust.userId, amountNaira);
          }
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

export default router;
