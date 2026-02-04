import { encrypt, decrypt, encryptLoginCredentials, decryptAuthToken, DEFAULT_KEY, DEFAULT_SALT } from "./encryption";

const ONECARD_BASE_URL = "https://api.onecardnigeria.com/rest";

interface OneCardSession {
  userToken: string;
  authToken: string;
  newSalt: string;
  userId: string;
  expiresAt: number;
}

let currentSession: OneCardSession | null = null;

async function makeRequest(
  endpoint: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    formData?: Record<string, string>;
  } = {}
): Promise<any> {
  const { method = "POST", headers = {}, formData } = options;
  
  let body: string | undefined;
  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  if (formData) {
    const urlParams = new URLSearchParams();
    for (const [key, value] of Object.entries(formData)) {
      urlParams.append(key, value);
    }
    body = urlParams.toString();
    requestHeaders["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const response = await fetch(`${ONECARD_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body,
  });

  const text = await response.text();
  
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function oneCardLogin(): Promise<OneCardSession> {
  const username = process.env.ONECARD_API_USERNAME;
  const password = process.env.ONECARD_API_PASSWORD;

  if (!username || !password) {
    throw new Error("OneCard API credentials not configured");
  }

  const { encryptedUsername, encryptedPassword } = encryptLoginCredentials(username, password);

  console.log("OneCard login attempt with encrypted credentials");

  let response = await makeRequest("/login", {
    formData: {
      username: encryptedUsername,
      pass: encryptedPassword,
    },
  });

  console.log("OneCard login raw response:", JSON.stringify(response));

  // If response is a string (possibly encrypted), try to decrypt then parse
  if (typeof response === "string") {
    // First try to parse as JSON directly
    try {
      response = JSON.parse(response);
      console.log("OneCard login parsed JSON response:", JSON.stringify(response));
    } catch {
      // Not valid JSON, try to decrypt
      console.log("Response is not JSON, attempting to decrypt");
      try {
        const decrypted = decrypt(response);
        console.log("OneCard login decrypted:", decrypted);
        response = JSON.parse(decrypted);
        console.log("OneCard login decrypted JSON:", JSON.stringify(response));
      } catch (e: any) {
        console.error("Decryption failed:", e.message);
        // The encrypted response likely indicates an authentication error
        // This could mean invalid credentials or the account is not properly configured
        throw new Error(
          "Unable to authenticate with OneCard API. This could be due to: " +
          "1) Invalid API credentials, " +
          "2) API account not properly configured, or " +
          "3) IP address not whitelisted in OneCard console. " +
          "Please verify your credentials at https://agent.onecardnigeria.com"
        );
      }
    }
  }

  console.log("OneCard login parsed response:", JSON.stringify(response));

  if (!response.RESPONSE) {
    throw new Error(response.RESPONSE_MSG || "OneCard login failed");
  }

  const { USER_TOKEN, AUTH_TOKEN, EXPIRE_AT } = response.RESPONSE_DATA;

  const { userId, newSalt } = decryptAuthToken(AUTH_TOKEN);

  currentSession = {
    userToken: USER_TOKEN,
    authToken: AUTH_TOKEN,
    newSalt,
    userId,
    expiresAt: EXPIRE_AT * 1000,
  };

  return currentSession;
}

export async function getSession(): Promise<OneCardSession> {
  if (!currentSession || Date.now() >= currentSession.expiresAt) {
    return await oneCardLogin();
  }
  return currentSession;
}

export function clearSession(): void {
  currentSession = null;
}

async function authenticatedRequest(
  endpoint: string,
  params?: Record<string, string>
): Promise<any> {
  const session = await getSession();

  const encryptedParams: Record<string, string> = {};
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      encryptedParams[key] = encrypt(value, session.userToken, session.newSalt);
    }
  }

  const response = await makeRequest(endpoint, {
    headers: {
      token: session.userToken,
      authtoken: session.authToken,
    },
    formData: Object.keys(encryptedParams).length > 0 ? encryptedParams : undefined,
  });

  return response;
}

export async function getBalance(): Promise<any> {
  return await authenticatedRequest("/balance");
}

export async function getServices(): Promise<any> {
  return await authenticatedRequest("/services");
}

export async function getProducts(serviceId?: string): Promise<any> {
  const params = serviceId ? { service_id: serviceId } : undefined;
  return await authenticatedRequest("/products", params);
}

export async function getProductItems(productId: string): Promise<any> {
  return await authenticatedRequest("/productItems", { product_id: productId });
}

export async function getProductParams(productId: string): Promise<any> {
  return await authenticatedRequest("/params", { product_id: productId });
}

export async function getCommissions(): Promise<any> {
  return await authenticatedRequest("/commissions");
}

export async function recharge(params: {
  productId: string;
  amount: string;
  mobile: string;
  referenceId?: string;
}): Promise<any> {
  const requestParams: Record<string, string> = {
    product_id: params.productId,
    amount: params.amount,
    mobile: params.mobile,
  };
  
  if (params.referenceId) {
    requestParams.reference_id = params.referenceId;
  }

  return await authenticatedRequest("/recharge", requestParams);
}

export async function billFetch(params: {
  productId: string;
  mobile: string;
}): Promise<any> {
  return await authenticatedRequest("/billfetch", {
    product_id: params.productId,
    mobile: params.mobile,
  });
}

export async function billPay(params: {
  productId: string;
  amount: string;
  mobile: string;
  referenceId?: string;
}): Promise<any> {
  const requestParams: Record<string, string> = {
    product_id: params.productId,
    amount: params.amount,
    mobile: params.mobile,
  };
  
  if (params.referenceId) {
    requestParams.reference_id = params.referenceId;
  }

  return await authenticatedRequest("/billpay", requestParams);
}

export async function oneCardLogout(): Promise<any> {
  const session = await getSession();
  
  const response = await makeRequest("/logout", {
    headers: {
      token: session.userToken,
      authtoken: session.authToken,
    },
  });

  clearSession();
  return response;
}

export async function getTransactionHistory(params?: {
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
}): Promise<any> {
  const requestParams: Record<string, string> = {};
  
  if (params?.startDate) requestParams.start_date = params.startDate;
  if (params?.endDate) requestParams.end_date = params.endDate;
  if (params?.page) requestParams.page = params.page;
  if (params?.limit) requestParams.limit = params.limit;

  return await authenticatedRequest("/transactions", 
    Object.keys(requestParams).length > 0 ? requestParams : undefined
  );
}
