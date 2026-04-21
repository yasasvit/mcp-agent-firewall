"use client";

import { useState } from "react";

type Scenario = "safe" | "path_traversal" | "obfuscated" | "jailbreak";

interface SimResult {
  allowed: boolean;
  blockReason: string;
  latencyMs: number;
  label: string;
}

const SCENARIOS: {
  id: Scenario;
  label: string;
  sublabel: string;
  btnClass: string;
}[] = [
  {
    id: "safe",
    label: "Safe Query",
    sublabel: "Summarize system logs",
    btnClass:
      "bg-green-900/40 text-green-300 ring-1 ring-green-500/40 hover:bg-green-900/70 focus-visible:ring-green-400",
  },
  {
    id: "path_traversal",
    label: "Path Traversal",
    sublabel: "Read /etc/passwd",
    btnClass:
      "bg-red-900/40 text-red-300 ring-1 ring-red-500/40 hover:bg-red-900/70 focus-visible:ring-red-400",
  },
  {
    id: "obfuscated",
    label: "Obfuscated Payload",
    sublabel: "Base64-encoded shell cmd",
    btnClass:
      "bg-orange-900/40 text-orange-300 ring-1 ring-orange-500/40 hover:bg-orange-900/70 focus-visible:ring-orange-400",
  },
  {
    id: "jailbreak",
    label: "Jailbreak Attempt",
    sublabel: "Prompt injection",
    btnClass:
      "bg-purple-900/40 text-purple-300 ring-1 ring-purple-500/40 hover:bg-purple-900/70 focus-visible:ring-purple-400",
  },
];

export function ThreatSimulator() {
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function run(scenario: Scenario, label: string) {
    setActiveScenario(scenario);
    setFetchError(null);
    setResult(null);

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, cache_buster: Date.now() }),
      });
      const data = (await res.json()) as {
        allowed: boolean;
        blockReason: string;
        latencyMs: number;
        error?: string;
      };
      if (!res.ok) {
        setFetchError(data.error ?? `HTTP ${res.status}`);
      } else {
        setResult({ ...data, label });
      }
    } catch {
      setFetchError("Network error — is the dev server running?");
    } finally {
      setActiveScenario(null);
    }
  }

  const isLoading = activeScenario !== null;

  return (
    <div className="rounded-lg bg-gray-900 ring-1 ring-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-red-900/40 ring-1 ring-red-500/40">
          <svg
            className="h-4 w-4 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">
            Live Threat Simulator
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Fire pre-canned attack payloads at the firewall and watch it decide
          </p>
        </div>
      </div>

      {/* Attack buttons */}
      <div className="px-6 pt-4 pb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SCENARIOS.map(({ id, label, sublabel, btnClass }) => (
          <button
            key={id}
            onClick={() => run(id, label)}
            disabled={isLoading}
            className={`relative flex flex-col items-start gap-0.5 rounded-md px-3 py-3 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${btnClass}`}
          >
            {activeScenario === id && (
              <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40">
                <svg
                  className="h-4 w-4 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </span>
            )}
            <span className="font-semibold leading-tight">{label}</span>
            <span className="opacity-60 leading-tight">{sublabel}</span>
          </button>
        ))}
      </div>

      {/* Terminal window */}
      <div className="px-6 pb-6">
        <div className="rounded-lg bg-slate-950 ring-1 ring-gray-800 overflow-hidden">
          {/* macOS-style title bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/50 border-b border-gray-800/80">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-green-500/70" />
            </div>
            <span className="ml-2 text-xs text-gray-500 font-[family-name:var(--font-geist-mono)]">
              sentinel — firewall output
            </span>
          </div>

          {/* Terminal body */}
          <div className="p-5 min-h-36 font-[family-name:var(--font-geist-mono)] text-xs leading-relaxed">
            {!result && !fetchError && !isLoading && (
              <p className="text-gray-600">
                <span className="text-gray-500 select-none">$ </span>
                Awaiting test — click a scenario above to fire a payload...
              </p>
            )}

            {isLoading && !result && (
              <div className="space-y-1 text-gray-400">
                <p>
                  <span className="text-gray-500 select-none">$ </span>
                  Sending payload to /api/simulate...
                </p>
                <p className="animate-pulse text-gray-500">
                  ▶ Running firewall inspection layers...
                </p>
              </div>
            )}

            {fetchError && (
              <p className="text-red-400">
                <span className="text-gray-500 select-none">$ </span>
                Error: {fetchError}
              </p>
            )}

            {result && (
              <div className="space-y-3">
                <p className="text-gray-500">
                  <span className="select-none">$ </span>
                  sentinel fire --scenario &quot;{result.label}&quot;
                </p>

                <div className="border-l-2 border-gray-700 pl-4 space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 w-32 flex-shrink-0">
                      Status:
                    </span>
                    {result.allowed ? (
                      <span className="text-green-400 font-semibold tracking-wide">
                        ✓ ALLOWED
                      </span>
                    ) : (
                      <span className="text-red-400 font-semibold tracking-wide">
                        ✗ BLOCKED
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 w-32 flex-shrink-0">
                      Block Reason:
                    </span>
                    {result.allowed ? (
                      <span className="text-gray-600">—</span>
                    ) : (
                      <span className="text-orange-300">
                        {result.blockReason}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 w-32 flex-shrink-0">
                      Latency:
                    </span>
                    <span className="text-blue-300">{result.latencyMs}ms</span>
                  </div>
                </div>

                <p className="text-gray-700 text-xs">
                  ── request complete ──────────────────────────────────
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
