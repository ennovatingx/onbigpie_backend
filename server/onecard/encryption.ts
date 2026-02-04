import crypto from "crypto";

const DEFAULT_KEY = "61f22f21-1fdc-45f1-acee-2a8a2bfc";
const DEFAULT_SALT = "22d2b48279af3df6";

function deriveKey(key: string): Buffer {
  // Try using first 16 bytes directly
  return Buffer.from(key.slice(0, 16), "utf8");
}

function deriveIV(salt: string): Buffer {
  // Salt is exactly 16 characters, use as-is
  return Buffer.from(salt, "utf8");
}

export function encrypt(
  plaintext: string,
  key: string = DEFAULT_KEY,
  salt: string = DEFAULT_SALT
): string {
  const keyBuffer = deriveKey(key);
  const iv = deriveIV(salt);
  
  console.log("Encrypt - Key length:", keyBuffer.length, "IV length:", iv.length);
  
  const cipher = crypto.createCipheriv("aes-128-cbc", keyBuffer, iv);
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  // Return as hex (matching the Postman example format)
  return encrypted.toString("hex");
}

export function decrypt(
  ciphertext: string,
  key: string = DEFAULT_KEY,
  salt: string = DEFAULT_SALT
): string {
  const keyBuffer = deriveKey(key);
  const iv = deriveIV(salt);
  
  console.log("Decrypt - Key length:", keyBuffer.length, "IV length:", iv.length);
  console.log("Ciphertext length:", ciphertext.length);
  
  const decipher = crypto.createDecipheriv("aes-128-cbc", keyBuffer, iv);
  
  // Determine if base64 or hex
  let inputBuffer: Buffer;
  if (ciphertext.includes("/") || ciphertext.includes("+") || ciphertext.endsWith("=")) {
    console.log("Detected base64 encoding");
    inputBuffer = Buffer.from(ciphertext, "base64");
  } else {
    console.log("Detected hex encoding");
    inputBuffer = Buffer.from(ciphertext, "hex");
  }
  
  console.log("Input buffer length:", inputBuffer.length);
  
  let decrypted = decipher.update(inputBuffer);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString("utf8");
}

export function encryptLoginCredentials(
  username: string,
  password: string
): { encryptedUsername: string; encryptedPassword: string } {
  return {
    encryptedUsername: encrypt(username),
    encryptedPassword: encrypt(password)
  };
}

export function decryptAuthToken(authToken: string): { userId: string; newSalt: string } {
  const decryptedToken = decrypt(authToken);
  const parts = decryptedToken.split("~");
  
  if (parts.length < 2) {
    throw new Error("Invalid AUTH_TOKEN format");
  }
  
  return {
    userId: parts[0],
    newSalt: parts[1]
  };
}

export { DEFAULT_KEY, DEFAULT_SALT };
