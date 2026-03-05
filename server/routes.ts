import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  registerSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  changePasswordSchema,
  resetPasswordSchema 
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import { registerOneCardRoutes } from "./onecard/routes";
import oneBigPieRoutes from "./onebigpie/routes";
import walletRoutes from "./paystack/routes";
import { createUser as createOneBigPieUser, fetchUserByEmail as fetchOneBigPieUser } from "./onebigpie/client";

const JWT_EXPIRES_IN = "24h";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

function createAuthToken(userId: string) {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

// Middleware to check authentication
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId?: string };
    if (!payload?.userId) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    (req as any).userId = payload.userId;
    next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Swagger UI setup
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "Authentication API Documentation"
  }));

  // Swagger JSON endpoint
  app.get("/api/swagger.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  /**
   * @swagger
   * /auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/RegisterRequest'
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       400:
   *         description: Validation error or email already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ValidationError'
   */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validationResult = registerSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({
          field: err.path.join("."),
          message: err.message
        }));
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      const { email, password, ...userData } = validationResult.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        ...userData,
        email,
        password: hashedPassword
      });

      const token = createAuthToken(user.id);

      // Return user without password
      const { password: _, resetToken, resetTokenExpiry, ...userResponse } = user;

      let oneBigPieUser = null;
      try {
        const obpResult = await createOneBigPieUser(
          email,
          validationResult.data.firstName,
          validationResult.data.lastName,
          validationResult.data.phoneNumber,
          password,
        );
        if (obpResult.status && obpResult.data) {
          oneBigPieUser = obpResult.data;
        }
      } catch (err) {
        console.error("OneBigPie user creation failed (non-blocking):", err);
      }

      if (!oneBigPieUser) {
        oneBigPieUser = await fetchOneBigPieUser(email);
      }

      res.status(201).json({
        message: "User registered successfully",
        user: userResponse,
        oneBigPieUser,
        token
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: Login with email and password
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LoginRequest'
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       401:
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const validationResult = loginSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({
          field: err.path.join("."),
          message: err.message
        }));
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      const { email, password } = validationResult.data;

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = createAuthToken(user.id);

      // Return user without password
      const { password: _, resetToken, resetTokenExpiry, ...userResponse } = user;

      const oneBigPieUser = await fetchOneBigPieUser(email);

      res.json({
        message: "Login successful",
        user: userResponse,
        oneBigPieUser,
        token
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * @swagger
   * /auth/forgot-password:
   *   post:
   *     summary: Request password reset
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ForgotPasswordRequest'
   *     responses:
   *       200:
   *         description: Password reset email sent (if email exists)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 resetToken:
   *                   type: string
   *                   description: Reset token (in production, this would be sent via email)
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ValidationError'
   */
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const validationResult = forgotPasswordSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({
          field: err.path.join("."),
          message: err.message
        }));
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      const { email } = validationResult.data;

      // Find user
      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ 
          message: "If the email exists, a password reset link has been sent" 
        });
      }

      // Generate reset token
      const resetToken = randomUUID();
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.updateUser(user.id, {
        resetToken,
        resetTokenExpiry
      });

      // In production, send email with reset link
      // For demo purposes, return the token
      res.json({ 
        message: "If the email exists, a password reset link has been sent",
        resetToken // In production, this would be sent via email
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * @swagger
   * /auth/reset-password:
   *   post:
   *     summary: Reset password using token
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ResetPasswordRequest'
   *     responses:
   *       200:
   *         description: Password reset successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       400:
   *         description: Invalid or expired token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const validationResult = resetPasswordSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({
          field: err.path.join("."),
          message: err.message
        }));
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      const { token, newPassword } = validationResult.data;

      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear reset token
      await storage.updateUser(user.id, {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      });

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * @swagger
   * /auth/change-password:
   *   post:
   *     summary: Change password for authenticated user
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ChangePasswordRequest'
   *     responses:
   *       200:
   *         description: Password changed successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       401:
   *         description: Unauthorized or invalid current password
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/auth/change-password", authenticateToken, async (req: Request, res: Response) => {
    try {
      const validationResult = changePasswordSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({
          field: err.path.join("."),
          message: err.message
        }));
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      const { currentPassword, newPassword } = validationResult.data;
      const userId = (req as any).userId;

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await storage.updateUser(userId, {
        password: hashedPassword
      });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * @swagger
   * /auth/me:
   *   get:
   *     summary: Get current authenticated user
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Current user info with linked OneBigPie data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *                 oneBigPieUser:
   *                   oneOf:
   *                     - $ref: '#/components/schemas/OneBigPieUser'
   *                     - type: 'null'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/auth/me", authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const { password: _, resetToken, resetTokenExpiry, ...userResponse } = user;

      const oneBigPieUser = await fetchOneBigPieUser(user.email);

      res.json({
        user: userResponse,
        oneBigPieUser,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * @swagger
   * /auth/logout:
   *   post:
   *     summary: Logout current user
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   */
  app.post("/api/auth/logout", authenticateToken, async (req: Request, res: Response) => {
    try {
      res.json({ message: "Logged out successfully. Discard token on client." });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Register OneCard Nigeria API routes
  registerOneCardRoutes(app);

  // Register OneBigPie API routes
  app.use("/api/onebigpie", oneBigPieRoutes);

  // Register Wallet/Paystack routes
  // Wallet routes handle their own auth - webhook is public, others check authenticateToken
  app.use("/api/wallet", (req, res, next) => {
    if (req.path === "/webhook" && req.method === "POST") {
      return next();
    }
    return authenticateToken(req, res, next);
  }, walletRoutes);

  return httpServer;
}
