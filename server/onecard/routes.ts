import type { Express, Request, Response } from "express";
import * as oneCardClient from "./client";

export function registerOneCardRoutes(app: Express): void {
  /**
   * @swagger
   * /onecard/login:
   *   post:
   *     summary: Login to OneCard Nigeria API
   *     tags: [OneCard]
   *     description: Authenticates with OneCard API and establishes a session. Session is automatically managed for subsequent requests.
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardLoginResponse'
   *       500:
   *         description: Login failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/onecard/login", async (req: Request, res: Response) => {
    try {
      const session = await oneCardClient.oneCardLogin();
      res.json({
        success: true,
        message: "OneCard login successful",
        data: {
          userId: session.userId,
          expiresAt: new Date(session.expiresAt).toISOString(),
        },
      });
    } catch (error: any) {
      console.error("OneCard login error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "OneCard login failed" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/logout:
   *   post:
   *     summary: Logout from OneCard Nigeria API
   *     tags: [OneCard]
   *     description: Ends the current OneCard session
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       500:
   *         description: Logout failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/onecard/logout", async (req: Request, res: Response) => {
    try {
      await oneCardClient.oneCardLogout();
      res.json({
        success: true,
        message: "OneCard logout successful",
      });
    } catch (error: any) {
      console.error("OneCard logout error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "OneCard logout failed" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/balance:
   *   get:
   *     summary: Get OneCard wallet balance
   *     tags: [OneCard]
   *     description: Returns the current wallet balance and related financial information
   *     responses:
   *       200:
   *         description: Balance retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardBalanceResponse'
   *       500:
   *         description: Failed to retrieve balance
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/onecard/balance", async (req: Request, res: Response) => {
    try {
      const balance = await oneCardClient.getBalance();
      res.json({
        success: true,
        data: balance,
      });
    } catch (error: any) {
      console.error("OneCard balance error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to get balance" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/services:
   *   get:
   *     summary: Get available OneCard services
   *     tags: [OneCard]
   *     description: Returns list of available services (Mobile, Data, Electricity, Cable TV, etc.)
   *     responses:
   *       200:
   *         description: Services retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardServicesResponse'
   *       500:
   *         description: Failed to retrieve services
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/onecard/services", async (req: Request, res: Response) => {
    try {
      const services = await oneCardClient.getServices();
      res.json({
        success: true,
        data: services,
      });
    } catch (error: any) {
      console.error("OneCard services error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to get services" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/products:
   *   get:
   *     summary: Get available products/operators
   *     tags: [OneCard]
   *     description: Returns list of products/operators. Can be filtered by service ID.
   *     parameters:
   *       - in: query
   *         name: service_id
   *         schema:
   *           type: string
   *         description: Optional service ID to filter products (e.g., "1" for Mobile, "3" for Data)
   *     responses:
   *       200:
   *         description: Products retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardProductsResponse'
   *       500:
   *         description: Failed to retrieve products
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/onecard/products", async (req: Request, res: Response) => {
    try {
      const serviceId = req.query.service_id as string | undefined;
      const products = await oneCardClient.getProducts(serviceId);
      res.json({
        success: true,
        data: products,
      });
    } catch (error: any) {
      console.error("OneCard products error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to get products" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/products/{productId}/items:
   *   get:
   *     summary: Get product items/denominations
   *     tags: [OneCard]
   *     description: Returns available denominations and items for a specific product
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *         description: The product/operator ID
   *     responses:
   *       200:
   *         description: Product items retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardProductItemsResponse'
   *       500:
   *         description: Failed to retrieve product items
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/onecard/products/:productId/items", async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const items = await oneCardClient.getProductItems(productId);
      res.json({
        success: true,
        data: items,
      });
    } catch (error: any) {
      console.error("OneCard product items error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to get product items" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/products/{productId}/params:
   *   get:
   *     summary: Get product parameters
   *     tags: [OneCard]
   *     description: Returns required parameters for a product (e.g., meter number format, phone number length)
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *         description: The product/operator ID
   *     responses:
   *       200:
   *         description: Product parameters retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardProductParamsResponse'
   *       500:
   *         description: Failed to retrieve product parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/onecard/products/:productId/params", async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const params = await oneCardClient.getProductParams(productId);
      res.json({
        success: true,
        data: params,
      });
    } catch (error: any) {
      console.error("OneCard product params error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to get product params" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/commissions:
   *   get:
   *     summary: Get commission rates
   *     tags: [OneCard]
   *     description: Returns commission/discount rates for all products
   *     responses:
   *       200:
   *         description: Commissions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardCommissionsResponse'
   *       500:
   *         description: Failed to retrieve commissions
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/onecard/commissions", async (req: Request, res: Response) => {
    try {
      const commissions = await oneCardClient.getCommissions();
      res.json({
        success: true,
        data: commissions,
      });
    } catch (error: any) {
      console.error("OneCard commissions error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to get commissions" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/recharge:
   *   post:
   *     summary: Perform airtime or data recharge
   *     tags: [OneCard]
   *     description: Processes a mobile airtime or data recharge transaction
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/OneCardRechargeRequest'
   *     responses:
   *       200:
   *         description: Recharge successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardRechargeResponse'
   *       400:
   *         description: Invalid request parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Recharge failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/onecard/recharge", async (req: Request, res: Response) => {
    try {
      const { productId, amount, mobile, referenceId } = req.body;

      if (!productId || !amount || !mobile) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: productId, amount, mobile",
        });
      }

      const result = await oneCardClient.recharge({
        productId,
        amount: String(amount),
        mobile,
        referenceId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("OneCard recharge error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Recharge failed" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/bill/fetch:
   *   post:
   *     summary: Fetch bill information
   *     tags: [OneCard]
   *     description: Retrieves bill details for electricity, cable TV, etc.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/OneCardBillFetchRequest'
   *     responses:
   *       200:
   *         description: Bill fetched successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardBillFetchResponse'
   *       400:
   *         description: Invalid request parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Failed to fetch bill
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/onecard/bill/fetch", async (req: Request, res: Response) => {
    try {
      const { productId, mobile } = req.body;

      if (!productId || !mobile) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: productId, mobile (meter/smart card number)",
        });
      }

      const result = await oneCardClient.billFetch({
        productId,
        mobile,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("OneCard bill fetch error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to fetch bill" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/bill/pay:
   *   post:
   *     summary: Pay a bill
   *     tags: [OneCard]
   *     description: Processes bill payment for electricity, cable TV, etc.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/OneCardBillPayRequest'
   *     responses:
   *       200:
   *         description: Bill payment successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardBillPayResponse'
   *       400:
   *         description: Invalid request parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Bill payment failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/onecard/bill/pay", async (req: Request, res: Response) => {
    try {
      const { productId, amount, mobile, referenceId } = req.body;

      if (!productId || !amount || !mobile) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: productId, amount, mobile (meter/smart card number)",
        });
      }

      const result = await oneCardClient.billPay({
        productId,
        amount: String(amount),
        mobile,
        referenceId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("OneCard bill pay error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Bill payment failed" 
      });
    }
  });

  /**
   * @swagger
   * /onecard/transactions:
   *   get:
   *     summary: Get transaction history
   *     tags: [OneCard]
   *     description: Returns transaction history with optional date filtering
   *     parameters:
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for filtering (YYYY-MM-DD)
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for filtering (YYYY-MM-DD)
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number for pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Number of records per page
   *     responses:
   *       200:
   *         description: Transactions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OneCardTransactionsResponse'
   *       500:
   *         description: Failed to retrieve transactions
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/onecard/transactions", async (req: Request, res: Response) => {
    try {
      const { start_date, end_date, page, limit } = req.query;
      
      const transactions = await oneCardClient.getTransactionHistory({
        startDate: start_date as string | undefined,
        endDate: end_date as string | undefined,
        page: page as string | undefined,
        limit: limit as string | undefined,
      });

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error: any) {
      console.error("OneCard transactions error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to get transactions" 
      });
    }
  });
}
