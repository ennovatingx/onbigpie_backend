import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { fundWalletSchema, deductWalletSchema } from "@shared/schema";
import { initializeTransaction, verifyTransaction, verifyWebhookSignature } from "./client";

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
      if (!existingTx || existingTx.status !== "pending") {
        return res.sendStatus(200);
      }

      const paidAmountNaira = (amount / 100).toFixed(2);
      if (paidAmountNaira !== existingTx.amount) {
        console.error(`Webhook amount mismatch for ${reference}: expected ${existingTx.amount}, got ${paidAmountNaira}`);
        await storage.updateWalletTransactionStatus(reference, "failed");
        return res.sendStatus(200);
      }

      await storage.atomicCreditWallet(reference, existingTx.userId, paidAmountNaira);
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

export default router;
