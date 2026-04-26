// Simple encryption/decryption untuk API keys
// Untuk production, gunakan proper encryption library

export function encryptApiKey(key: string): string {
  // Simple base64 encoding (untuk demo)
  // Untuk production, gunakan crypto library seperti tweetnacl atau libsodium
  return Buffer.from(key).toString("base64");
}

export function decryptApiKey(encrypted: string): string {
  try {
    return Buffer.from(encrypted, "base64").toString("utf-8");
  } catch {
    throw new Error("Failed to decrypt API key");
  }
}
