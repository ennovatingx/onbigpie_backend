import { Router, Request, Response } from "express";
import * as oneBigPieClient from "./client.ts";
import { OneBigPieError } from "./client.ts";

const router = Router();

function handleError(res: Response, error: unknown) {
  if (error instanceof OneBigPieError) {
    const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
  const message = error instanceof Error ? error.message : "Unknown error occurred";
  return res.status(500).json({ success: false, error: message });
}

/**
 * @swagger
 * /api/onebigpie/users:
 *   post:
 *     summary: Create a new user
 *     tags: [OneBigPie]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OneBigPieCreateUserRequest'
 *     responses:
 *       200:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OneBigPieUserResponse'
 *       500:
 *         description: Server error
 */
router.post("/users", async (req: Request, res: Response) => {
  try {
    const { email, firstname, lastname, phone, password } = req.body;

    if (!email || !firstname || !lastname || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: email, firstname, lastname, phone, password",
      });
    }

    const result = await oneBigPieClient.createUser(
      email,
      firstname,
      lastname,
      phone,
      password
    );
    res.json(result);
  } catch (error) {
    console.error("OneBigPie create user error:", error);
    return handleError(res, error);
  }
});

/**
 * @swagger
 * /api/onebigpie/users:
 *   get:
 *     summary: Fetch all users
 *     tags: [OneBigPie]
 *     responses:
 *       200:
 *         description: Users fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OneBigPieUsersListResponse'
 *       500:
 *         description: Server error
 */
router.get("/users", async (_req: Request, res: Response) => {
  try {
    const result = await oneBigPieClient.fetchUsers();
    res.json(result);
  } catch (error) {
    console.error("OneBigPie fetch users error:", error);
    return handleError(res, error);
  }
});

/**
 * @swagger
 * /api/onebigpie/subscribe:
 *   post:
 *     summary: Subscribe a user with a voucher
 *     tags: [OneBigPie]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OneBigPieSubscribeRequest'
 *     responses:
 *       200:
 *         description: User subscribed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OneBigPieSubscribeResponse'
 *       500:
 *         description: Server error
 */
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const { email, voucher } = req.body;

    if (!email || !voucher) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: email, voucher",
      });
    }

    const result = await oneBigPieClient.subscribeUser(email, voucher);
    res.json(result);
  } catch (error) {
    console.error("OneBigPie subscribe user error:", error);
    return handleError(res, error);
  }
});

/**
 * @swagger
 * /api/onebigpie/subscribed-users:
 *   get:
 *     summary: Fetch all subscribed users
 *     tags: [OneBigPie]
 *     responses:
 *       200:
 *         description: Subscribed users fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OneBigPieSubscribedUsersResponse'
 *       500:
 *         description: Server error
 */
router.get("/subscribed-users", async (_req: Request, res: Response) => {
  try {
    const result = await oneBigPieClient.fetchSubscribedUsers();
    res.json(result);
  } catch (error) {
    console.error("OneBigPie fetch subscribed users error:", error);
    return handleError(res, error);
  }
});

/**
 * @swagger
 * /api/onebigpie/vouchers/generate:
 *   post:
 *     summary: Generate vouchers
 *     tags: [OneBigPie]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OneBigPieGenerateVouchersRequest'
 *     responses:
 *       200:
 *         description: Vouchers generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OneBigPieGenerateVouchersResponse'
 *       500:
 *         description: Server error
 */
router.post("/vouchers/generate", async (req: Request, res: Response) => {
  try {
    const { quantity } = req.body;

    const numQuantity = Number(quantity);
    if (!quantity || isNaN(numQuantity) || numQuantity < 1 || !Number.isInteger(numQuantity)) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid quantity (must be a positive integer)",
      });
    }

    const result = await oneBigPieClient.generateVouchers(numQuantity);
    res.json(result);
  } catch (error) {
    console.error("OneBigPie generate vouchers error:", error);
    return handleError(res, error);
  }
});

/**
 * @swagger
 * /api/onebigpie/vouchers:
 *   get:
 *     summary: Fetch all vouchers
 *     tags: [OneBigPie]
 *     responses:
 *       200:
 *         description: Vouchers fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OneBigPieVouchersListResponse'
 *       500:
 *         description: Server error
 */
router.get("/vouchers", async (_req: Request, res: Response) => {
  try {
    const result = await oneBigPieClient.fetchVouchers();
    res.json(result);
  } catch (error) {
    console.error("OneBigPie fetch vouchers error:", error);
    return handleError(res, error);
  }
});

export default router;
