import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, numeric, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  universityName: text("university_name"),
  matriculationNumber: text("matriculation_number"),
  phoneNumber: text("phone_number"),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  app: text("app"),
  isAuthorized: boolean("is_authorized").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  resetToken: true,
  resetTokenExpiry: true,
});

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  universityName: z.string().min(1, "University name is required"),
  matriculationNumber: z.string().optional(),
  phoneNumber: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const paystackCustomers = pgTable("paystack_customers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  customerCode: text("customer_code").notNull().unique(),
  paystackCustomerId: integer("paystack_customer_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dedicatedAccounts = pgTable("dedicated_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  customerCode: text("customer_code").notNull(),
  bankName: text("bank_name").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull().unique(),
  bankId: integer("bank_id"),
  active: integer("active").notNull().default(1),
  assignedAt: timestamp("assigned_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull().references(() => wallets.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  reference: text("reference").notNull().unique(),
  status: text("status").notNull().default("pending"),
  description: text("description"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: varchar("referrer_id").notNull().references(() => users.id),
  refereeId: varchar("referee_id").notNull().references(() => users.id),
  referralCode: text("referral_code").notNull().unique(),
  status: text("status").notNull().default("active"),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  quoteType: text("quote_type").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  requestData: text("request_data").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const socialLinks = pgTable("social_links", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  socialOrigin: text("social_origin").notNull(),
  whatsappNumber: text("whatsapp_number").notNull(),
  socialName: text("social_name").notNull(),
  socialCode: text("social_code").notNull().unique(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fundWalletSchema = z.object({
  amount: z.number().min(100, "Minimum funding amount is 100 Naira"),
  callbackUrl: z.string().url().optional(),
});

export const deductWalletSchema = z.object({
  amount: z.number().min(1, "Amount must be at least 1 Naira"),
  description: z.string().min(1, "Description is required"),
  reference: z.string().optional(),
});

export const createReferralSchema = z.object({
  refereeEmail: z.string().email("Invalid email address"),
  referralCode: z.string().min(3, "Referral code must be at least 3 characters"),
});

export const createQuoteSchema = z.object({
  quoteType: z.string().min(1, "Quote type is required"),
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Valid email is required"),
  notes: z.string().optional(),
  requestData: z.record(z.any()).optional().default({}),
});

export const updateQuoteSchema = z.object({
  status: z.enum(["pending", "accepted", "rejected", "completed"], {
    errorMap: () => ({ message: "Invalid status" }),
  }).optional(),
  notes: z.string().optional(),
  requestData: z.record(z.any()).optional(),
});

export const createSocialLinkSchema = z.object({
  name: z.string().min(1, "Name is required"),
  socialOrigin: z.string().min(1, "Social origin is required"),
  whatsappNumber: z.string().min(10, "Valid WhatsApp number is required"),
  socialName: z.string().min(1, "Social name is required"),
});

export const updateSocialLinkSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  socialOrigin: z.string().min(1, "Social origin is required").optional(),
  whatsappNumber: z.string().min(10, "Valid WhatsApp number is required").optional(),
  socialName: z.string().min(1, "Social name is required").optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PaystackCustomer = typeof paystackCustomers.$inferSelect;
export type DedicatedAccount = typeof dedicatedAccounts.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type SocialLink = typeof socialLinks.$inferSelect;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type FundWalletInput = z.infer<typeof fundWalletSchema>;
export type DeductWalletInput = z.infer<typeof deductWalletSchema>;
export type CreateReferralInput = z.infer<typeof createReferralSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type CreateSocialLinkInput = z.infer<typeof createSocialLinkSchema>;
export type UpdateSocialLinkInput = z.infer<typeof updateSocialLinkSchema>;
