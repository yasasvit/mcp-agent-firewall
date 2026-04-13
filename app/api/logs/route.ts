import { NextResponse } from "next/server";
import redis from "@/lib/redis";

export async function GET() {
  const raw = await redis.lrange("mcp:logs", 0, 99);
  const logs = raw.map((entry) =>
    typeof entry === "string" ? JSON.parse(entry) : entry
  );
  return NextResponse.json(logs);
}
