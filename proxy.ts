import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import redis from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

const WAF_RULES: Record<string, RegExp[]> = {
  execute_bash: [/rm\s+-rf/i, /\bwget\b/, /\bcurl\b/, /\bchmod\b/, /\bsudo\b/, />\s*\/dev\/null/],
  sql_query: [/DROP\s+TABLE/i, /DELETE\s+FROM/i, /TRUNCATE\s+TABLE/i, /DROP\s+DATABASE/i, /;\s*--/],
  read_file: [/\/etc\/passwd/, /\/etc\/shadow/, /\.\.\//, /~\/.ssh/],
  write_file: [/\/etc\//, /\.\.\//, /\bauthorized_keys\b/],
  execute_python: [/\bos\.system\b/, /\bsubprocess\b/, /\b__import__\b/, /\beval\s*\(/],
};

type LogStatus = "Allowed" | "Blocked" | "RateLimited";

interface LogEntry {
  timestamp: string;
  ip: string;
  toolName: string | undefined;
  status: LogStatus;
  reason: string;
}

async function logRequest(entry: LogEntry): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.lpush("mcp:logs", JSON.stringify(entry));
  pipeline.ltrim("mcp:logs", 0, 999);
  await pipeline.exec();
}

export const config = {
  matcher: ["/api/mcp"],
};

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  if (!req.nextUrl.pathname.startsWith("/api/mcp")) {
    return NextResponse.next();
  }

  if (req.method !== "POST") {
    return NextResponse.next();
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";
  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  if (!success) {
    event.waitUntil(
      logRequest({
        timestamp: new Date().toISOString(),
        ip,
        toolName: undefined,
        status: "RateLimited",
        reason: "Sliding window rate limit exceeded",
      })
    );
    return NextResponse.json(
      {
        error: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please slow down.",
        status: 429,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  }

  let toolName: string | undefined;

  try {
    const body = await req.clone().json();
    toolName = body?.params?.name;
  } catch {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!toolName) {
    return NextResponse.next();
  }

  const isBlocked = await redis.sismember("mcp:blocklist", toolName);

  if (isBlocked) {
    event.waitUntil(
      logRequest({
        timestamp: new Date().toISOString(),
        ip,
        toolName,
        status: "Blocked",
        reason: `Tool '${toolName}' is on the blocklist`,
      })
    );
    return NextResponse.json(
      {
        error: "TOOL_BLOCKED",
        message: `The requested MCP tool '${toolName}' is not permitted.`,
        tool: toolName,
        status: 403,
      },
      { status: 403 }
    );
  }

  // Level 2: Deep Argument Inspection
  let parsedArguments: unknown = undefined;
  const wafPatterns = WAF_RULES[toolName];
  if (wafPatterns) {
    let body: Record<string, unknown>;
    try {
      body = await req.clone().json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    parsedArguments = body?.params?.arguments;
    const argsStr = JSON.stringify(parsedArguments ?? "");
    for (const pattern of wafPatterns) {
      if (pattern.test(argsStr)) {
        event.waitUntil(
          logRequest({
            timestamp: new Date().toISOString(),
            ip,
            toolName,
            status: "Blocked",
            reason: `Blocked by Level 2 Argument Inspection (Matched pattern: ${pattern})`,
          })
        );
        return NextResponse.json(
          {
            error: "ARGUMENT_BLOCKED",
            message: `Dangerous argument pattern detected for tool '${toolName}'.`,
            tool: toolName,
            status: 403,
          },
          { status: 403 }
        );
      }
    }
  }

  // Level 3: Agentic LLM Evaluator
  if (parsedArguments === undefined) {
    try {
      const body = await req.clone().json();
      parsedArguments = body?.params?.arguments;
    } catch {
      // no arguments to inspect — skip Level 3
    }
  }

  if (parsedArguments !== undefined) {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 10000);

    let l3Safe = false;
    let l3Reason = "Level 3 evaluator timed out or failed";

    try {
      const l3Res = await fetch("http://localhost:8001/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: parsedArguments }),
        signal: abort.signal,
      });

      if (!l3Res.ok) {
        // 500/502 from evaluator — fail closed
        l3Safe = false;
        l3Reason = `Level 3 evaluator returned HTTP ${l3Res.status} — failing closed`;
      } else {
        const result = await l3Res.json() as { safe: boolean; reason: string };
        l3Safe = result.safe;
        l3Reason = result.reason;
      }
    } catch {
      // timeout or network error — fail closed
      l3Safe = false;
      l3Reason = "Level 3 evaluator timed out — failing closed";
    } finally {
      clearTimeout(timeout);
    }

    if (!l3Safe) {
      event.waitUntil(
        logRequest({
          timestamp: new Date().toISOString(),
          ip,
          toolName,
          status: "Blocked",
          reason: `Blocked by Level 3 Agentic Evaluator: ${l3Reason}`,
        })
      );
      return NextResponse.json(
        {
          error: "AGENTIC_EVALUATOR_BLOCKED",
          message: `Request blocked by Level 3 Agentic Evaluator for tool '${toolName}'.`,
          tool: toolName,
          status: 403,
        },
        { status: 403 }
      );
    }
  }

  event.waitUntil(
    logRequest({
      timestamp: new Date().toISOString(),
      ip,
      toolName,
      status: "Allowed",
      reason: "Tool passed all checks",
    })
  );
  return NextResponse.json({ status: "success", message: "Tool allowed", tool: toolName });
}
