import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, numeric, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  universityName: text("university_name").notNull(),
  matriculationNumber: text("matriculation_number"),
  phoneNumber: text("phone_number").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
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

export const fundWalletSchema = z.object({
  amount: z.number().min(100, "Minimum funding amount is 100 Naira"),
  callbackUrl: z.string().url().optional(),
});

export const deductWalletSchema = z.object({
  amount: z.number().min(1, "Amount must be at least 1 Naira"),
  description: z.string().min(1, "Description is required"),
  reference: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PaystackCustomer = typeof paystackCustomers.$inferSelect;
export type DedicatedAccount = typeof dedicatedAccounts.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type FundWalletInput = z.infer<typeof fundWalletSchema>;
export type DeductWalletInput = z.infer<typeof deductWalletSchema>;
