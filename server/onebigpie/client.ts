const ONEBIGPIE_BASE_URL = "https://myshelta.com/testapps/api/onebigpie";
const ONEBIGPIE_HEADER_KEY = "MYSHELTA";
const ONEBIGPIE_HEADER_VALUE = "MYSHELTAONEBIGPIEACCESS";

export interface OneBigPieUser {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  usercode: string;
  created_at: string;
  role?: number;
  accounttype?: string;
  refereecode?: string;
}

export interface OneBigPieVoucher {
  id: number;
  code: string;
  stringed: string;
  amount: string;
  used: string;
  used_date: string | null;
  used_by: string | null;
  deactivated: string;
  created_at: string;
}

export interface SubscribedUser {
  userid: number;
  amount: string;
  date: string;
  expirydate: string;
  user: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    usercode: string;
  };
}

export interface SubscriptionBalance {
  userid: number;
  amount: string;
  bankdump: string;
  date: string;
  method: string;
  type: string;
  expirydate: string;
  state_id: string | null;
  voucher_info: string;
  refereecode: string;
  id: number;
  created_at: string;
  updated_at: string;
}

export interface VoucherBulkPurchase {
  type_id: string | null;
  type: string;
  amount: number;
  quantity: string;
  user_id: number;
  requested_date: string;
  payment_method: string;
  uploaded_file_name: string | null;
  serial: string;
  status: string;
  generated_date: string;
  generated_by: number;
  id: number;
  created_at: string;
  updated_at: string;
}

export class OneBigPieError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "OneBigPieError";
    this.statusCode = statusCode;
  }
}

async function makeRequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, string>,
): Promise<T> {
  const url = `${ONEBIGPIE_BASE_URL}${endpoint}`;

  console.log(`OneBigPie API ${method} ${url}`);

  const headers: Record<string, string> = {
    [ONEBIGPIE_HEADER_KEY]: ONEBIGPIE_HEADER_VALUE,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (method === "POST" && body) {
    const formParams = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      formParams.append(key, value);
    }
    options.body = formParams.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  console.log(`OneBigPie API ${method} ${endpoint}`);

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OneBigPie API error: ${response.status} - ${errorText}`);
    throw new OneBigPieError(
      `OneBigPie API error: ${errorText}`,
      response.status,
    );
  }

  const data = await response.json();
  return data;
}

export async function createUser(
  email: string,
  firstname: string,
  lastname: string,
  phone: string,
): Promise<{ status: boolean; message: string; data: OneBigPieUser }> {
  return makeRequest("/create-user", "POST", {
    email,
    firstname,
    lastname,
    phone,
  });
}

export async function fetchUsers(): Promise<{
  status: boolean;
  message: string;
  data: OneBigPieUser[];
}> {
  return makeRequest("/fetch-users", "GET");
}

export async function subscribeUser(
  email: string,
  voucher: string,
): Promise<{ success: string; balance: SubscriptionBalance }> {
  return makeRequest("/subscribe-user", "POST", {
    email,
    voucher,
  });
}

export async function fetchSubscribedUsers(): Promise<{
  status: boolean;
  message: string;
  data: SubscribedUser[];
}> {
  return makeRequest("/fetch-subscribed-users", "GET");
}

export async function generateVouchers(quantity: number): Promise<{
  status: boolean;
  message: string;
  data: VoucherBulkPurchase;
}> {
  return makeRequest("/generate-vouchers", "POST", {
    quantity: quantity.toString(),
  });
}

export async function fetchVouchers(): Promise<{
  status: boolean;
  message: string;
  data: OneBigPieVoucher[];
}> {
  return makeRequest("/fetch-vouchers", "GET");
}
