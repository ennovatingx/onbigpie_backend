import crypto from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY not set");
  return key;
}

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    channel: string;
    paid_at: string | null;
    created_at: string;
    gateway_response: string;
    customer: {
      id: number;
      email: string;
      first_name: string | null;
      last_name: string | null;
    };
    metadata: Record<string, any> | null;
  };
}

export async function initializeTransaction(
  email: string,
  amountInKobo: number,
  reference: string,
  callbackUrl?: string,
  metadata?: Record<string, any>,
): Promise<PaystackInitResponse> {
  const body: Record<string, any> = {
    email,
    amount: amountInKobo.toString(),
    reference,
    channels: ["card", "bank", "ussd", "bank_transfer"],
  };
  if (callbackUrl) body.callback_url = callbackUrl;
  if (metadata) body.metadata = metadata;

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Paystack error: ${data.message || response.statusText}`);
  }
  return data as PaystackInitResponse;
}

export async function verifyTransaction(
  reference: string,
): Promise<PaystackVerifyResponse> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
      },
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Paystack error: ${data.message || response.statusText}`);
  }
  return data as PaystackVerifyResponse;
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
): boolean {
  const hash = crypto
    .createHmac("sha512", getSecretKey())
    .update(body)
    .digest("hex");
  return hash === signature;
}
