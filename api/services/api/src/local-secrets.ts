import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = process.cwd();
const defaultDataDirectory = existsSync(join(workspaceRoot, "services", "api"))
  ? join(workspaceRoot, "services", "api", ".local-data")
  : join(workspaceRoot, ".local-data");
export const localDataDirectory = process.env.HARBOR_DATA_DIR ?? defaultDataDirectory;

export function getLocalSecret(name: string): string {
  mkdirSync(localDataDirectory, { recursive: true });
  const path = join(localDataDirectory, name);
  if (existsSync(path)) return readSecret(path);

  const secret = randomBytes(32).toString("base64url");
  try {
    writeFileSync(path, `${secret}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return secret;
  } catch (reason) {
    if (typeof reason === "object" && reason !== null && "code" in reason && reason.code === "EEXIST") {
      return readSecret(path);
    }
    throw reason;
  }
}

function readSecret(path: string): string {
  const secret = readFileSync(path, "utf8").trim();
  if (secret.length < 32) throw new Error(`Local secret file ${path} is empty or invalid.`);
  return secret;
}
