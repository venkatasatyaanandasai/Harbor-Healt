import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "./config.js";

function encryptionKey() {
  const configuredKey = config.donorDataEncryptionKey;
  if (!configuredKey) throw new Error("Donor contact encryption is not configured.");
  return createHash("sha256").update(configuredKey, "utf8").digest();
}

export function encryptDonorPhone(phone: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
  return {
    phoneCiphertext: ciphertext.toString("base64"),
    phoneIv: iv.toString("base64"),
    phoneAuthTag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptDonorPhone(phoneCiphertext: string, phoneIv: string, phoneAuthTag: string) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(phoneIv, "base64"));
  decipher.setAuthTag(Buffer.from(phoneAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(phoneCiphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}
