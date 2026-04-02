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

export interface PaystackCustomerResponse {
  status: boolean;
  message: string;
  data: {
    email: string;
    customer_code: string;
    id: number;
    integration: number;
    domain: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    identified: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface PaystackFetchCustomerResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string;
    customer_code: string;
    phone: string | null;
    metadata: Record<string, any> | null;
    risk_action: string;
    international_format_phone: string | null;
    identified: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface PaystackDVAResponse {
  status: boolean;
  message: string;
  data: {
    bank: {
      name: string;
      id: number;
      slug: string;
    };
    account_name: string;
    account_number: string;
    assigned: boolean;
    currency: string;
    metadata: Record<string, any> | null;
    active: boolean;
    id: number;
    created_at: string;
    updated_at: string;
    assignment: {
      integration: number;
      assignee_id: number;
      assignee_type: string;
      expired: boolean;
      account_type: string;
      assigned_at: string;
    };
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
      customer_code: string;
      phone: string | null;
    };
  };
}

export async function createPaystackCustomer(
  email: string,
  firstName: string,
  lastName: string,
  phone: string,
): Promise<PaystackCustomerResponse> {
  const response = await fetch(`${PAYSTACK_BASE_URL}/customer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Paystack customer error: ${data.message || response.statusText}`);
  }
  return data as PaystackCustomerResponse;
}

export async function fetchPaystackCustomer(
  emailOrCode: string,
): Promise<PaystackFetchCustomerResponse> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/customer/${encodeURIComponent(emailOrCode)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
      },
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Paystack customer fetch error: ${data.message || response.statusText}`);
  }

  return data as PaystackFetchCustomerResponse;
}


export async function fetchCustomerTransactions (
  customer: number,
): Promise<any> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transactions?customer_id=${customer}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
      },
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Paystack customer transactions error: ${data.message || response.statusText}`);
  }
  return data;
}

export async function createDedicatedAccount(
  customerCode: string,
  preferredBank?: string,
): Promise<PaystackDVAResponse> {
  const body: Record<string, any> = {
    customer: customerCode,
  };
  if (preferredBank) body.preferred_bank = preferredBank;

  const response = await fetch(`${PAYSTACK_BASE_URL}/dedicated_account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Paystack DVA error: ${data.message || response.statusText}`);
  }
  return data as PaystackDVAResponse;
}

export async function fetchDedicatedAccount(
  dedicatedAccountId: number,
): Promise<PaystackDVAResponse> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/dedicated_account/${dedicatedAccountId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
      },
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Paystack DVA fetch error: ${data.message || response.statusText}`);
  }
  return data as PaystackDVAResponse;
}

export async function listAvailableProviders(): Promise<any> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/dedicated_account/available_providers`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
      },
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Paystack providers error: ${data.message || response.statusText}`);
  }
  return data;
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
