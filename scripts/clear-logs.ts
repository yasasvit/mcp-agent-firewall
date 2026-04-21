import { readFileSync } from "fs";
import { resolve } from "path";
import { Redis } from "@upstash/redis";

// Load .env.local before initializing the Redis client
const envFile = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envFile, "utf-8").split("\n")) {
  const match = line.match(/^([^#\s][^=]*)=(.+)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function main() {
  const deleted = await redis.del("mcp:logs");
  console.log(deleted ? "mcp:logs cleared." : "mcp:logs was already empty.");
}

main();
