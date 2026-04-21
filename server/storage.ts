import { type User, type InsertUser, type Wallet, type WalletTransaction, type PaystackCustomer, type DedicatedAccount, type Referral, type Quote, type SocialLink, type SocialNumber, type SavedSocialNumber, users, wallets, walletTransactions, paystackCustomers, dedicatedAccounts, referrals, quotes, socialLinks, socialNumbers, savedSocialNumbers } from "../shared/schema.ts";
import { db } from "./db.ts";
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
  createPaystackCustomer(data: { userId: string; customerCode: string; paystackCustomerId: number }): Promise<PaystackCustomer>;
  getPaystackCustomerByUserId(userId: string): Promise<PaystackCustomer | undefined>;
  createDedicatedAccount(data: { userId: string; customerCode: string; bankName: string; accountName: string; accountNumber: string; bankId?: number; active?: number; assignedAt?: Date }): Promise<DedicatedAccount>;
  getDedicatedAccountByUserId(userId: string): Promise<DedicatedAccount | undefined>;
  updateDedicatedAccount(userId: string, data: Partial<DedicatedAccount>): Promise<DedicatedAccount | undefined>;
  getPaystackCustomerByCustomerCode(customerCode: string): Promise<PaystackCustomer | undefined>;
  getDedicatedAccountByAccountNumber(accountNumber: string): Promise<DedicatedAccount | undefined>;
  createReferral(data: { referrerId: string; refereeId: string; referralCode: string; status?: string }): Promise<Referral>;
  getReferralById(id: number): Promise<Referral | undefined>;
  getReferralsByReferrerId(referrerId: string): Promise<Referral[]>;
  getReferralByCode(code: string): Promise<Referral | undefined>;
  updateReferral(id: number, updates: Partial<Referral>): Promise<Referral | undefined>;
  deleteReferral(id: number): Promise<void>;
  createQuote(data: { userId: string | null; quoteType: string; fullName: string; phone: string; email: string; notes?: string; requestData?: Record<string, any>; status?: string }): Promise<Quote>;
  getQuoteById(id: string): Promise<Quote | undefined>;
  getQuotesByUserId(userId: string): Promise<Quote[]>;
  updateQuote(id: string, updates: Partial<Quote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<void>;
  createSocialLink(data: { userId: string; name: string; socialOrigin: string; whatsappNumber: string; socialName: string }): Promise<SocialLink>;
  getSocialLinkById(id: number): Promise<SocialLink | undefined>;
  getSocialLinksByUserId(userId: string): Promise<SocialLink[]>;
  getSocialLinkByCode(socialCode: string): Promise<SocialLink | undefined>;
  updateSocialLink(id: number, updates: Partial<SocialLink>): Promise<SocialLink | undefined>;
  deleteSocialLink(id: number): Promise<void>;
  createSocialNumber(data: { userId: string; name: string; phoneNumber: string }): Promise<SocialNumber>;
  getSocialNumberById(id: number): Promise<SocialNumber | undefined>;
  getSocialNumbersByUserId(userId: string): Promise<SocialNumber[]>;
  updateSocialNumber(id: number, updates: Partial<SocialNumber>): Promise<SocialNumber | undefined>;
  deleteSocialNumber(id: number): Promise<void>;
  createSavedSocialNumber(data: { phoneNumber: string }): Promise<SavedSocialNumber>;
  getSavedSocialNumberById(id: number): Promise<SavedSocialNumber | undefined>;
  getSavedSocialNumbers(): Promise<SavedSocialNumber[]>;
  updateSavedSocialNumber(id: number, updates: Partial<SavedSocialNumber>): Promise<SavedSocialNumber | undefined>;
  deleteSavedSocialNumber(id: number): Promise<void>;
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

  async createPaystackCustomer(data: { userId: string; customerCode: string; paystackCustomerId: number }): Promise<PaystackCustomer> {
    const [customer] = await db.insert(paystackCustomers).values(data).returning();
    return customer;
  }

  async getPaystackCustomerByUserId(userId: string): Promise<PaystackCustomer | undefined> {
    const [customer] = await db.select().from(paystackCustomers).where(eq(paystackCustomers.userId, userId));
    return customer;
  }

  async createDedicatedAccount(data: { userId: string; customerCode: string; bankName: string; accountName: string; accountNumber: string; bankId?: number; active?: number; assignedAt?: Date }): Promise<DedicatedAccount> {
    const [account] = await db.insert(dedicatedAccounts).values(data).returning();
    return account;
  }

  async getDedicatedAccountByUserId(userId: string): Promise<DedicatedAccount | undefined> {
    const [account] = await db.select().from(dedicatedAccounts).where(eq(dedicatedAccounts.userId, userId));
    return account;
  }
  async updateDedicatedAccount(userId: string, data: Partial<DedicatedAccount>): Promise<DedicatedAccount | undefined> {
    const [account] = await db.update(dedicatedAccounts)
      .set(data)
      .where(eq(dedicatedAccounts.userId, userId))
      .returning();
    return account;
  }

  async getPaystackCustomerByCustomerCode(customerCode: string): Promise<PaystackCustomer | undefined> {
    const [customer] = await db.select().from(paystackCustomers).where(eq(paystackCustomers.customerCode, customerCode));
    return customer;
  }

  async getDedicatedAccountByAccountNumber(accountNumber: string): Promise<DedicatedAccount | undefined> {
    const [account] = await db.select().from(dedicatedAccounts).where(eq(dedicatedAccounts.accountNumber, accountNumber));
    return account;
  }

  // Referral methods
  async createReferral(data: { referrerId: string; refereeId: string; referralCode: string; status?: string }): Promise<Referral> {
    const [referral] = await db.insert(referrals).values({
      ...data,
      status: data.status || "active",
    }).returning();
    return referral;
  }

  async getReferralById(id: number): Promise<Referral | undefined> {
    const [referral] = await db.select().from(referrals).where(eq(referrals.id, id));
    return referral;
  }

  async getReferralsByReferrerId(referrerId: string): Promise<Referral[]> {
    return db.select().from(referrals)
      .where(eq(referrals.referrerId, referrerId))
      .orderBy(desc(referrals.createdAt));
  }

  async getReferralByCode(code: string): Promise<Referral | undefined> {
    const [referral] = await db.select().from(referrals).where(eq(referrals.referralCode, code));
    return referral;
  }

  async updateReferral(id: number, updates: Partial<Referral>): Promise<Referral | undefined> {
    const [referral] = await db.update(referrals)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(referrals.id, id))
      .returning();
    return referral;
  }

  async deleteReferral(id: number): Promise<void> {
    await db.delete(referrals).where(eq(referrals.id, id));
  }

  // Quote methods
  async createQuote(data: { userId: string | null; quoteType: string; fullName: string; phone: string; email: string; notes?: string; requestData?: Record<string, any>; status?: string }): Promise<Quote> {
    const [quote] = await db.insert(quotes).values({
      userId: data.userId,
      quoteType: data.quoteType,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      notes: data.notes,
      requestData: JSON.stringify(data.requestData || {}),
      status: data.status || "pending",
    }).returning();
    return quote;
  }

  async getQuoteById(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async getQuotesByUserId(userId: string): Promise<Quote[]> {
    return db.select().from(quotes)
      .where(eq(quotes.userId, userId))
      .orderBy(desc(quotes.createdAt));
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote | undefined> {
    const updateData: any = { ...updates };
    if (updateData.requestData && typeof updateData.requestData === "object") {
      updateData.requestData = JSON.stringify(updateData.requestData);
    }
    updateData.updatedAt = new Date();
    
    const [quote] = await db.update(quotes)
      .set(updateData)
      .where(eq(quotes.id, id))
      .returning();
    return quote;
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  // Social Link methods
  async createSocialLink(data: { userId: string; name: string; socialOrigin: string; whatsappNumber: string; socialName: string }): Promise<SocialLink> {
    // Generate unique social code
    const socialCode = `${data.socialOrigin.slice(0, 3).toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const [socialLink] = await db.insert(socialLinks).values({
      ...data,
      socialCode,
      status: "active",
    }).returning();
    return socialLink;
  }

  async getSocialLinkById(id: number): Promise<SocialLink | undefined> {
    const [socialLink] = await db.select().from(socialLinks).where(eq(socialLinks.id, id));
    return socialLink;
  }

  async getSocialLinksByUserId(userId: string): Promise<SocialLink[]> {
    return db.select().from(socialLinks)
      .where(eq(socialLinks.userId, userId))
      .orderBy(desc(socialLinks.createdAt));
  }

  async getSocialLinkByCode(socialCode: string): Promise<SocialLink | undefined> {
    const [socialLink] = await db.select().from(socialLinks).where(eq(socialLinks.socialCode, socialCode));
    return socialLink;
  }

  async updateSocialLink(id: number, updates: Partial<SocialLink>): Promise<SocialLink | undefined> {
    const [socialLink] = await db.update(socialLinks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(socialLinks.id, id))
      .returning();
    return socialLink;
  }

  async deleteSocialLink(id: number): Promise<void> {
    await db.delete(socialLinks).where(eq(socialLinks.id, id));
  }

  async createSocialNumber(data: { userId: string; name: string; phoneNumber: string }): Promise<SocialNumber> {
    const [socialNumber] = await db.insert(socialNumbers).values({
      ...data,
      status: "active",
      isVerified: false,
    }).returning();
    return socialNumber;
  }

  async getSocialNumberById(id: number): Promise<SocialNumber | undefined> {
    const [socialNumber] = await db.select().from(socialNumbers).where(eq(socialNumbers.id, id));
    return socialNumber;
  }

  async getSocialNumbersByUserId(userId: string): Promise<SocialNumber[]> {
    return db.select().from(socialNumbers)
      .where(eq(socialNumbers.userId, userId))
      .orderBy(desc(socialNumbers.createdAt));
  }

  async updateSocialNumber(id: number, updates: Partial<SocialNumber>): Promise<SocialNumber | undefined> {
    const [socialNumber] = await db.update(socialNumbers)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(socialNumbers.id, id))
      .returning();
    return socialNumber;
  }

  async deleteSocialNumber(id: number): Promise<void> {
    await db.delete(socialNumbers).where(eq(socialNumbers.id, id));
  }

  async createSavedSocialNumber(data: { phoneNumber: string }): Promise<SavedSocialNumber> {
    const [savedSocialNumber] = await db.insert(savedSocialNumbers).values({
      phoneNumber: data.phoneNumber,
    }).returning();
    return savedSocialNumber;
  }

  async getSavedSocialNumberById(id: number): Promise<SavedSocialNumber | undefined> {
    const [savedSocialNumber] = await db.select().from(savedSocialNumbers).where(eq(savedSocialNumbers.id, id));
    return savedSocialNumber;
  }

  async getSavedSocialNumbers(): Promise<SavedSocialNumber[]> {
    return db.select().from(savedSocialNumbers).orderBy(desc(savedSocialNumbers.createdAt));
  }

  async updateSavedSocialNumber(id: number, updates: Partial<SavedSocialNumber>): Promise<SavedSocialNumber | undefined> {
    const [savedSocialNumber] = await db.update(savedSocialNumbers)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(savedSocialNumbers.id, id))
      .returning();
    return savedSocialNumber;
  }

  async deleteSavedSocialNumber(id: number): Promise<void> {
    await db.delete(savedSocialNumbers).where(eq(savedSocialNumbers.id, id));
  }
}

export const storage = new DatabaseStorage();
