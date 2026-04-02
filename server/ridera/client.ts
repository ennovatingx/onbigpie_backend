const RIDERA_BASE_URL = process.env.RIDERA_API_BASE_URL || "https://api.ridera.io";
const RIDERA_API_KEY = process.env.RIDERA_API_KEY || "";

export interface RideraQuote {
  id: string;
  quoteType: string;
  fullName: string;
  phone: string;
  email: string;
  notes?: string;
  status: string;
  requestData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SocialLink {
  id: string;
  userId: string;
  name: string;
  socialOrigin: string;
  whatsappNumber: string;
  socialName: string;
  socialCode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export class RideraError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = "RideraError";
    this.statusCode = statusCode;
  }
}

async function makeRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, any>,
): Promise<T> {
  const url = `${RIDERA_BASE_URL}${endpoint}`;

  console.log(`Ridera API ${method} ${url}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (RIDERA_API_KEY) {
    headers["Authorization"] = `Bearer ${RIDERA_API_KEY}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (method !== "GET" && body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ridera API error: ${response.status} - ${errorText}`);
      throw new RideraError(
        `Ridera API error: ${errorText || response.statusText}`,
        response.status,
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof RideraError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Ridera API request failed:", message);
    throw new RideraError(message, 500);
  }
}

/**
 * Estimate fare for a ride based on pickup and dropoff locations
 */
export async function estimateFare(
  pickupLocation: string,
  dropoffLocation: string,
  vehicleType: string = "economy",
): Promise<RideraQuote> {
  return makeRequest<RideraQuote>("/api/estimates", "POST", {
    pickupLocation,
    dropoffLocation,
    vehicleType,
  });
}

/**
 * Get referral information by referral code
 */
export async function getReferralByCode(referralCode: string): Promise<RideraReferral> {
  return makeRequest<RideraReferral>(`/api/referrals/code/${referralCode}`, "GET");
}

/**
 * Create a new referral code for a user
 */
export async function createReferralCode(
  userId: string,
  referralCode: string,
): Promise<RideraReferral> {
  return makeRequest<RideraReferral>("/api/referrals", "POST", {
    userId,
    referralCode,
  });
}

/**
 * Validate a referral code (check if it exists and is active)
 */
export async function validateReferralCode(referralCode: string): Promise<boolean> {
  try {
    await getReferralByCode(referralCode);
    return true;
  } catch (error) {
    if (error instanceof RideraError && error.statusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Apply referral code to a booking
 */
export async function applyReferralToBooking(
  bookingId: string,
  referralCode: string,
): Promise<{ success: boolean; discountAmount: number }> {
  return makeRequest(`/api/bookings/${bookingId}/apply-referral`, "POST", {
    referralCode,
  });
}

/**
 * Get commission earned from referrals
 */
export async function getCommissionBalance(userId: string): Promise<{ balance: number; currency: string }> {
  return makeRequest(`/api/users/${userId}/commission`, "GET");
}

/**
 * Create a new social link
 */
export async function createSocialLink(
  userId: string,
  data: {
    name: string;
    socialOrigin: string;
    whatsappNumber: string;
    socialName: string;
  },
): Promise<SocialLink> {
  return makeRequest<SocialLink>("/api/social-links", "POST", {
    userId,
    ...data,
  });
}

/**
 * Get all social links for a user
 */
export async function getSocialLinksByUser(userId: string): Promise<SocialLink[]> {
  return makeRequest<SocialLink[]>(`/api/social-links/user/${userId}`, "GET");
}

/**
 * Get social link by ID
 */
export async function getSocialLinkById(id: string): Promise<SocialLink> {
  return makeRequest<SocialLink>(`/api/social-links/${id}`, "GET");
}

/**
 * Get social link by social code
 */
export async function getSocialLinkByCode(socialCode: string): Promise<SocialLink> {
  return makeRequest<SocialLink>(`/api/social-links/code/${socialCode}`, "GET");
}

/**
 * Update a social link
 */
export async function updateSocialLink(
  id: string,
  updates: Partial<Omit<SocialLink, "id" | "userId" | "socialCode" | "createdAt">>,
): Promise<SocialLink> {
  return makeRequest<SocialLink>(`/api/social-links/${id}`, "PATCH", updates);
}

/**
 * Delete a social link
 */
export async function deleteSocialLink(id: string): Promise<void> {
  await makeRequest(`/api/social-links/${id}`, "DELETE");
}
