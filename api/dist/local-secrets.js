"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localDataDirectory = void 0;
exports.getLocalSecret = getLocalSecret;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const workspaceRoot = process.cwd();
const defaultDataDirectory = (0, node_fs_1.existsSync)((0, node_path_1.join)(workspaceRoot, "services", "api"))
    ? (0, node_path_1.join)(workspaceRoot, "services", "api", ".local-data")
    : (0, node_path_1.join)(workspaceRoot, ".local-data");
exports.localDataDirectory = process.env.HARBOR_DATA_DIR ?? defaultDataDirectory;
function getLocalSecret(name) {
    (0, node_fs_1.mkdirSync)(exports.localDataDirectory, { recursive: true });
    const path = (0, node_path_1.join)(exports.localDataDirectory, name);
    if ((0, node_fs_1.existsSync)(path))
        return readSecret(path);
    const secret = (0, node_crypto_1.randomBytes)(32).toString("base64url");
    try {
        (0, node_fs_1.writeFileSync)(path, `${secret}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
        return secret;
    }
    catch (reason) {
        if (typeof reason === "object" && reason !== null && "code" in reason && reason.code === "EEXIST") {
            return readSecret(path);
        }
        throw reason;
    }
}
function readSecret(path) {
    const secret = (0, node_fs_1.readFileSync)(path, "utf8").trim();
    if (secret.length < 32)
        throw new Error(`Local secret file ${path} is empty or invalid.`);
    return secret;
}
