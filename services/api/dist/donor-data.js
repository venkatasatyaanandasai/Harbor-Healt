"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptDonorPhone = encryptDonorPhone;
exports.decryptDonorPhone = decryptDonorPhone;
const node_crypto_1 = require("node:crypto");
const config_js_1 = require("./config.js");
function encryptionKey() {
    const configuredKey = config_js_1.config.donorDataEncryptionKey;
    if (!configuredKey)
        throw new Error("Donor contact encryption is not configured.");
    return (0, node_crypto_1.createHash)("sha256").update(configuredKey, "utf8").digest();
}
function encryptDonorPhone(phone) {
    const iv = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)("aes-256-gcm", encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
    return {
        phoneCiphertext: ciphertext.toString("base64"),
        phoneIv: iv.toString("base64"),
        phoneAuthTag: cipher.getAuthTag().toString("base64")
    };
}
function decryptDonorPhone(phoneCiphertext, phoneIv, phoneAuthTag) {
    const decipher = (0, node_crypto_1.createDecipheriv)("aes-256-gcm", encryptionKey(), Buffer.from(phoneIv, "base64"));
    decipher.setAuthTag(Buffer.from(phoneAuthTag, "base64"));
    return Buffer.concat([
        decipher.update(Buffer.from(phoneCiphertext, "base64")),
        decipher.final()
    ]).toString("utf8");
}
