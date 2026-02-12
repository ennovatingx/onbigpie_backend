import { type User, type InsertUser, type Wallet, type WalletTransaction, users, wallets, walletTransactions } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getOrCreateWallet(userId: string): Promise<Wallet>;
  getWalletByUserId(userId: string): Promise<Wallet | undefined>;
  creditWallet(userId: string, amount: string): Promise<Wallet>;
  debitWallet(userId: string, amount: string): Promise<Wallet>;
  createWalletTransaction(data: { walletId: number; userId: string; type: string; amount: string; reference: string; status: string; description?: string; metadata?: string }): Promise<WalletTransaction>;
  updateWalletTransactionStatus(reference: string, status: string): Promise<WalletTransaction | undefined>;
  atomicCreditWallet(reference: string, userId: string, amount: string): Promise<{ wallet: Wallet; transaction: WalletTransaction } | null>;
  getWalletTransactionByReference(reference: string): Promise<WalletTransaction | undefined>;
  getWalletTransactions(userId: string): Promise<WalletTransaction[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      matriculationNumber: insertUser.matriculationNumber ?? null,
    }).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const existing = await this.getWalletByUserId(userId);
    if (existing) return existing;
    const [wallet] = await db.insert(wallets).values({ userId }).returning();
    return wallet;
  }

  async getWalletByUserId(userId: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return wallet;
  }

  async creditWallet(userId: string, amount: string): Promise<Wallet> {
    const [wallet] = await db.update(wallets)
      .set({
        balance: sql`${wallets.balance}::numeric + ${amount}::numeric`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, userId))
      .returning();
    return wallet;
  }

  async debitWallet(userId: string, amount: string): Promise<Wallet> {
    const [wallet] = await db.update(wallets)
      .set({
        balance: sql`${wallets.balance}::numeric - ${amount}::numeric`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, userId))
      .returning();
    return wallet;
  }

  async createWalletTransaction(data: { walletId: number; userId: string; type: string; amount: string; reference: string; status: string; description?: string; metadata?: string }): Promise<WalletTransaction> {
    const [tx] = await db.insert(walletTransactions).values(data).returning();
    return tx;
  }

  async updateWalletTransactionStatus(reference: string, status: string): Promise<WalletTransaction | undefined> {
    const [tx] = await db.update(walletTransactions)
      .set({ status })
      .where(eq(walletTransactions.reference, reference))
      .returning();
    return tx;
  }

  async atomicCreditWallet(reference: string, userId: string, amount: string): Promise<{ wallet: Wallet; transaction: WalletTransaction } | null> {
    return await db.transaction(async (trx) => {
      const [tx] = await trx.update(walletTransactions)
        .set({ status: "success" })
        .where(sql`${walletTransactions.reference} = ${reference} AND ${walletTransactions.status} = 'pending'`)
        .returning();

      if (!tx) return null;

      const [wallet] = await trx.update(wallets)
        .set({
          balance: sql`${wallets.balance}::numeric + ${amount}::numeric`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId))
        .returning();

      return { wallet, transaction: tx };
    });
  }

  async getWalletTransactionByReference(reference: string): Promise<WalletTransaction | undefined> {
    const [tx] = await db.select().from(walletTransactions).where(eq(walletTransactions.reference, reference));
    return tx;
  }

  async getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
    return db.select().from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt));
  }
}

export const storage = new DatabaseStorage();
