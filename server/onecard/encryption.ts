import crypto from "crypto";

const DEFAULT_KEY = "61f22f21-1fdc-45f1-acee-2a8a2bfc";
const DEFAULT_SALT = "22d2b48279af3df6";

function deriveKey(key: string): Buffer {
  const keyBuffer = Buffer.alloc(32, 0);
  Buffer.from(key, "utf8").copy(keyBuffer);
  return keyBuffer;
}

function deriveIV(salt: string): Buffer {
  return Buffer.from(salt.slice(0, 16), "utf8");
}

export function encrypt(
  plaintext: string,
  key: string = DEFAULT_KEY,
  salt: string = DEFAULT_SALT
): string {
  const keyBuffer = deriveKey(key);
  const iv = deriveIV(salt);
  
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuffer, iv);
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return encrypted.toString("base64");
}

export function decrypt(
  ciphertext: string,
  key: string = DEFAULT_KEY,
  salt: string = DEFAULT_SALT
): string {
  const keyBuffer = deriveKey(key);
  const iv = deriveIV(salt);
  
  let inputBuffer: Buffer;
  if (ciphertext.includes("/") || ciphertext.includes("+") || ciphertext.endsWith("=")) {
    inputBuffer = Buffer.from(ciphertext, "base64");
  } else {
    inputBuffer = Buffer.from(ciphertext, "hex");
  }
  
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, iv);
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
