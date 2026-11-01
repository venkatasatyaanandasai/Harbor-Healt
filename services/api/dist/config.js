"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
const local_secrets_js_1 = require("./local-secrets.js");
const mode = process.env.APP_MODE ?? (process.env.NODE_ENV === "production" ? "production" : "local");
if (mode !== "local" && mode !== "demo" && mode !== "production")
    throw new Error("APP_MODE must be local, demo, or production.");
if (mode === "production") {
    if (!process.env.DATABASE_URL)
        throw new Error("DATABASE_URL is required in production.");
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters in production.");
    }
    if (!process.env.DONOR_DATA_ENCRYPTION_KEY || process.env.DONOR_DATA_ENCRYPTION_KEY.length < 32) {
        throw new Error("DONOR_DATA_ENCRYPTION_KEY must be at least 32 characters in production.");
    }
}
if (process.env.AZURE_OPENAI_ENDPOINT) {
    const endpoint = new URL(process.env.AZURE_OPENAI_ENDPOINT);
    if (endpoint.protocol !== "https:")
        throw new Error("AZURE_OPENAI_ENDPOINT must use HTTPS.");
}
exports.config = {
    mode,
    port: Number(process.env.PORT ?? 4000),
    jwtSecret: process.env.JWT_SECRET ?? (mode === "local" ? (0, local_secrets_js_1.getLocalSecret)("jwt-secret") : undefined),
    donorDataEncryptionKey: process.env.DONOR_DATA_ENCRYPTION_KEY ?? (mode === "local" ? (0, local_secrets_js_1.getLocalSecret)("donor-encryption-key") : undefined),
    azureOpenAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
    azureOpenAiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    azureOpenAiApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21",
    databaseUrl: process.env.DATABASE_URL,
    blobConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    blobContainer: process.env.AZURE_STORAGE_CONTAINER ?? "health-records",
    allowedOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173"
};
