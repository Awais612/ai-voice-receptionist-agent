import path from "path";
import { readFileSync } from "fs";
import { defineConfig } from "prisma/config";

function loadEnvFile(): Record<string, string> {
  try {
    const lines = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8").split("\n");
    const env: Record<string, string> = {};
    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) env[match[1]] = match[2];
    }
    return env;
  } catch {
    return {};
  }
}

const fileEnv = loadEnvFile();
const dbUrl = process.env.DATABASE_URL ?? fileEnv["DATABASE_URL"];

export default defineConfig({
  datasource: { url: dbUrl },
});
