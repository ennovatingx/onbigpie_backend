import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "crypto";
import { storage } from "../storage.ts";
import { createReferralSchema, createQuoteSchema, updateQuoteSchema, createSocialLinkSchema, updateSocialLinkSchema, createSocialNumberSchema, updateSocialNumberSchema, createSavedSocialNumberSchema, updateSavedSocialNumberSchema } from "../../shared/schema.ts";
import * as rideraClient from "./client.ts";
import { authenticateToken } from "../routes.ts";

const router = Router();

/**
 * @swagger
 * /ridera/referrals:
 *   post:
 *     summary: Create a new referral
 *     tags: [Ridera]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReferralRequest'
 *     responses:
 *       201:
 *         description: Referral created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReferralResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */

router.post("/referrals", authenticateToken,  async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const validationResult = createReferralSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const { refereeEmail, referralCode } = validationResult.data;

    // Get referee by email
    const referee = await storage.getUserByEmail(refereeEmail);
    if (!referee) {
      return res.status(404).json({ error: "Referee not found" });
    }

    if (referee.id === userId) {
      return res.status(400).json({ error: "Cannot refer yourself" });
    }

    // Create referral in database
    const referral = await storage.createReferral({
      referrerId: userId,
      refereeId: referee.id,
      referralCode,
      status: "active",
    });

    return res.status(201).json({
      success: true,
      data: referral,
    });
  } catch (error) {
    console.error("Create referral error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/referrals:
 *   get:
 *     summary: Get all referrals for authenticated user
 *     tags: [Ridera]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referrals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReferralResponse'
 *       401:
 *         description: Unauthorized
 */
router.get("/referrals", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const referrals = await storage.getReferralsByReferrerId(userId);
    return res.json({
      success: true,
      data: referrals,
    });
  } catch (error) {
    console.error("Get referrals error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/referrals/{id}:
 *   get:
 *     summary: Get referral by ID
 *     tags: [Ridera]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Referral ID
 *     responses:
 *       200:
 *         description: Referral retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ReferralResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Referral not found
 */
router.get("/referrals/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ error: "Invalid referral ID" });
    }

    const referral = await storage.getReferralById(id);
    if (!referral) {
      return res.status(404).json({ error: "Referral not found" });
    }

    // Ensure user owns this referral
    if (referral.referrerId !== userId && referral.refereeId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      success: true,
      data: referral,
    });
  } catch (error) {
    console.error("Get referral error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/referrals/{id}:
 *   patch:
 *     summary: Update referral status
 *     tags: [Ridera]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Referral ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, completed]
 *     responses:
 *       200:
 *         description: Referral updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ReferralResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Referral not found
 */
router.patch("/referrals/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ error: "Invalid referral ID" });
    }

    const referral = await storage.getReferralById(id);
    if (!referral) {
      return res.status(404).json({ error: "Referral not found" });
    }

    if (referral.referrerId !== userId) {
      return res.status(403).json({ error: "Only referrer can update" });
    }

    const { status } = req.body;
    if (!["active", "inactive", "completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await storage.updateReferral(id, { status });
    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update referral error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/referrals/{id}:
 *   delete:
 *     summary: Delete a referral
 *     tags: [Ridera]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Referral ID
 *     responses:
 *       200:
 *         description: Referral deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Referral not found
 */
router.delete("/referrals/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ error: "Invalid referral ID" });
    }

    const referral = await storage.getReferralById(id);
    if (!referral) {
      return res.status(404).json({ error: "Referral not found" });
    }

    if (referral.referrerId !== userId) {
      return res.status(403).json({ error: "Only referrer can delete" });
    }

    await storage.deleteReferral(id);
    return res.json({
      success: true,
      message: "Referral deleted successfully",
    });
  } catch (error) {
    console.error("Delete referral error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/quotes:
 *   post:
 *     summary: Create a ride quote request
 *     tags: [Ridera]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQuoteRequest'
 *     responses:
 *       201:
 *         description: Quote created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuoteResponse'
 *       400:
 *         description: Validation error
 */
router.post("/quotes",  async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || null;

    const validationResult = createQuoteSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const { quoteType, fullName, phone, email, notes, requestData } = validationResult.data;

    const quote = await storage.createQuote({
      userId,
      quoteType,
      fullName,
      phone,
      email,
      notes,
      requestData,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      data: quote,
    });
  } catch (error) {
    console.error("Create quote error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/quotes:
 *   get:
 *     summary: Get all quotes for authenticated user
 *     tags: [Ridera]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quotes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/QuoteResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User not authorized for this service
 */
router.get("/quotes", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.isAuthorized) {
      return res.status(403).json({ error: "User not authorized for this service" });
    }

    const quotes = await storage.getQuotesByUserId(userId);
    return res.json({
      success: true,
      data: quotes,
    });
  } catch (error) {
    console.error("Get quotes error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/quotes/{id}:
 *   get:
 *     summary: Get quote by ID
 *     tags: [Ridera]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quote ID (UUID)
 *     responses:
 *       200:
 *         description: Quote retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/QuoteResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User not authorized for this service
 *       404:
 *         description: Quote not found
 */
router.get("/quotes/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.isAuthorized) {
      return res.status(403).json({ error: "User not authorized for this service" });
    }

    const id = req.params.id as string;
    if (!id) {
      return res.status(400).json({ error: "Quote ID is required" });
    }

    const quote = await storage.getQuoteById(id);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    return res.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    console.error("Get quote error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/quotes/{id}:
 *   patch:
 *     summary: Update quote status or details
 *     tags: [Ridera]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quote ID (UUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateQuoteRequest'
 *     responses:
 *       200:
 *         description: Quote updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/QuoteResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User not authorized for this service
 *       404:
 *         description: Quote not found
 */
router.patch("/quotes/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.isAuthorized) {
      return res.status(403).json({ error: "User not authorized for this service" });
    }

    const id = req.params.id as string;
    if (!id) {
      return res.status(400).json({ error: "Quote ID is required" });
    }

    const validationResult = updateQuoteSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const quote = await storage.getQuoteById(id);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const { status, notes, requestData } = validationResult.data;
    const updates: any = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (requestData !== undefined) updates.requestData = requestData;
    updates.updatedAt = new Date();

    const updated = await storage.updateQuote(id as string, updates);
    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update quote error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/quotes/{id}:
 *   delete:
 *     summary: Delete a quote
 *     tags: [Ridera]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quote ID (UUID)
 *     responses:
 *       200:
 *         description: Quote deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User not authorized for this service
 *       404:
 *         description: Quote not found
 */
router.delete("/quotes/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.isAuthorized) {
      return res.status(403).json({ error: "User not authorized for this service" });
    }

    const id = req.params.id as string;
    if (!id) {
      return res.status(400).json({ error: "Quote ID is required" });
    }

    const quote = await storage.getQuoteById(id);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    await storage.deleteQuote(id);
    return res.json({
      success: true,
      message: "Quote deleted successfully",
    });
  } catch (error) {
    console.error("Delete quote error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-links:
 *   post:
 *     summary: Create a new social link
 *     tags: [Social Links]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSocialLinkRequest'
 *     responses:
 *       201:
 *         description: Social link created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SocialLinkResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/social-links", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const validationResult = createSocialLinkSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const socialLink = await storage.createSocialLink({
      userId,
      ...validationResult.data,
    });

    return res.status(201).json({
      success: true,
      data: socialLink,
    });
  } catch (error) {
    console.error("Create social link error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-links:
 *   get:
 *     summary: Get all social links for authenticated user
 *     tags: [Social Links]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Social links retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SocialLinkResponse'
 *       401:
 *         description: Unauthorized
 */
router.get("/social-links", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const socialLinks = await storage.getSocialLinksByUserId(userId);
    return res.json({
      success: true,
      data: socialLinks,
    });
  } catch (error) {
    console.error("Get social links error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-links/{id}:
 *   get:
 *     summary: Get social link by ID
 *     tags: [Social Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Social Link ID
 *     responses:
 *       200:
 *         description: Social link retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SocialLinkResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Social link not found
 */
router.get("/social-links/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ error: "Invalid social link ID" });
    }

    const socialLink = await storage.getSocialLinkById(id);
    if (!socialLink) {
      return res.status(404).json({ error: "Social link not found" });
    }

    // Ensure user owns this social link
    if (socialLink.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      success: true,
      data: socialLink,
    });
  } catch (error) {
    console.error("Get social link error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-links/code/{socialCode}:
 *   get:
 *     summary: Get social link by social code (public endpoint)
 *     tags: [Social Links]
 *     parameters:
 *       - in: path
 *         name: socialCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Social Code
 *     responses:
 *       200:
 *         description: Social link retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SocialLinkResponse'
 *       404:
 *         description: Social link not found
 */
router.get("/social-links/code/:socialCode", async (req: Request, res: Response) => {
  try {
    const { socialCode } = req.params;
    if (!socialCode) {
      return res.status(400).json({ error: "Social code is required" });
    }

    const socialLink = await storage.getSocialLinkByCode(socialCode);
    if (!socialLink) {
      return res.status(404).json({ error: "Social link not found" });
    }

    // Exclude direct userId from public endpoint
    const { userId, ...publicData } = socialLink;
    return res.json({
      success: true,
      data: publicData,
    });
  } catch (error) {
    console.error("Get social link by code error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-links/{id}:
 *   patch:
 *     summary: Update a social link
 *     tags: [Social Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Social Link ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSocialLinkRequest'
 *     responses:
 *       200:
 *         description: Social link updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SocialLinkResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Social link not found
 */
router.patch("/social-links/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ error: "Invalid social link ID" });
    }

    const socialLink = await storage.getSocialLinkById(id);
    if (!socialLink) {
      return res.status(404).json({ error: "Social link not found" });
    }

    if (socialLink.userId !== userId) {
      return res.status(403).json({ error: "Only owner can update" });
    }

    const validationResult = updateSocialLinkSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const updated = await storage.updateSocialLink(id, validationResult.data);
    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update social link error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-links/{id}:
 *   delete:
 *     summary: Delete a social link
 *     tags: [Social Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Social Link ID
 *     responses:
 *       200:
 *         description: Social link deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Social link not found
 */
router.delete("/social-links/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ error: "Invalid social link ID" });
    }

    const socialLink = await storage.getSocialLinkById(id);
    if (!socialLink) {
      return res.status(404).json({ error: "Social link not found" });
    }

    if (socialLink.userId !== userId) {
      return res.status(403).json({ error: "Only owner can delete" });
    }

    await storage.deleteSocialLink(id);
    return res.json({
      success: true,
      message: "Social link deleted successfully",
    });
  } catch (error) {
    console.error("Delete social link error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-numbers:
 *   post:
 *     summary: Create a new social number
 *     tags: [Social Numbers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSocialNumberRequest'
 *     responses:
 *       201:
 *         description: Social number created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SocialNumberResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/social-numbers", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const validationResult = createSocialNumberSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const socialNumber = await storage.createSocialNumber({
      userId,
      ...validationResult.data,
    });

    return res.status(201).json({
      success: true,
      data: socialNumber,
    });
  } catch (error) {
    console.error("Create social number error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-numbers:
 *   get:
 *     summary: Get all social numbers for authenticated user
 *     tags: [Social Numbers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Social numbers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SocialNumberResponse'
 *       401:
 *         description: Unauthorized
 */
router.get("/social-numbers", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const socialNumbers = await storage.getSocialNumbersByUserId(userId);
    return res.json({
      success: true,
      data: socialNumbers,
    });
  } catch (error) {
    console.error("Get social numbers error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-numbers/{id}:
 *   get:
 *     summary: Get social number by ID
 *     tags: [Social Numbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Social Number ID
 *     responses:
 *       200:
 *         description: Social number retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SocialNumberResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Social number not found
 */
router.get("/social-numbers/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ error: "Invalid social number ID" });
    }

    const socialNumber = await storage.getSocialNumberById(id);
    if (!socialNumber) {
      return res.status(404).json({ error: "Social number not found" });
    }

    // Ensure user owns this social number
    if (socialNumber.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      success: true,
      data: socialNumber,
    });
  } catch (error) {
    console.error("Get social number error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-numbers/{id}:
 *   patch:
 *     summary: Update a social number
 *     tags: [Social Numbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Social Number ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSocialNumberRequest'
 *     responses:
 *       200:
 *         description: Social number updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SocialNumberResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Social number not found
 */
router.patch("/social-numbers/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ error: "Invalid social number ID" });
    }

    const socialNumber = await storage.getSocialNumberById(id);
    if (!socialNumber) {
      return res.status(404).json({ error: "Social number not found" });
    }

    if (socialNumber.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const validationResult = updateSocialNumberSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const updated = await storage.updateSocialNumber(id, validationResult.data);
    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update social number error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/social-numbers/{id}:
 *   delete:
 *     summary: Delete a social number
 *     tags: [Social Numbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Social Number ID
 *     responses:
 *       200:
 *         description: Social number deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Social number not found
 */
router.delete("/social-numbers/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ error: "Invalid social number ID" });
    }

    const socialNumber = await storage.getSocialNumberById(id);
    if (!socialNumber) {
      return res.status(404).json({ error: "Social number not found" });
    }

    if (socialNumber.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await storage.deleteSocialNumber(id);
    return res.json({
      success: true,
      message: "Social number deleted successfully",
    });
  } catch (error) {
    console.error("Delete social number error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/saved-social-numbers:
 *   post:
 *     summary: Save a social number for quick access
 *     tags: [Saved Social Numbers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSavedSocialNumberRequest'
 *     responses:
 *       201:
 *         description: Social number saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SavedSocialNumberResponse'
 *       400:
 *         description: Validation error
 */
router.post("/saved-social-numbers", async (req: Request, res: Response) => {
  try {
    const validationResult = createSavedSocialNumberSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const savedSocialNumber = await storage.createSavedSocialNumber({
      phoneNumber: validationResult.data.phoneNumber,
    });

    return res.status(201).json({
      success: true,
      data: savedSocialNumber,
    });
  } catch (error) {
    console.error("Create saved social number error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /ridera/saved-social-numbers:
 *   get:
 *     summary: Get saved social numbers (public)
 *     tags: [Saved Social Numbers]
 *     responses:
 *       200:
 *         description: Saved social numbers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SavedSocialNumberResponse'
 */
router.get("/saved-social-numbers", async (req: Request, res: Response) => {
  try {
    const savedSocialNumbers = await storage.getSavedSocialNumbers();
    return res.json({
      success: true,
      data: savedSocialNumbers,
    });
  } catch (error) {
    console.error("Get saved social numbers error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
