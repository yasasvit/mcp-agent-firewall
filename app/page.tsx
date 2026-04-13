"use client";

import { useCallback, useEffect, useState } from "react";

type LogStatus = "Allowed" | "Blocked" | "RateLimited";

interface LogEntry {
  timestamp: string;
  ip: string;
  toolName: string | undefined;
  status: LogStatus;
  reason: string;
}

const STATUS_BADGE: Record<LogStatus, string> = {
  Allowed: "bg-green-900/60 text-green-300 ring-1 ring-green-500/40",
  Blocked: "bg-red-900/60 text-red-300 ring-1 ring-red-500/40",
  RateLimited: "bg-yellow-900/60 text-yellow-300 ring-1 ring-yellow-500/40",
};

const STATUS_LABEL: Record<LogStatus, string> = {
  Allowed: "Allowed",
  Blocked: "Blocked",
  RateLimited: "Rate Limited",
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function StatusBadge({ status, reason }: { status: LogStatus; reason: string }) {
  if (reason.includes("Level 3")) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-900/60 text-red-300 ring-1 ring-red-500/40">
        AI Block
      </span>
    );
  }
  if (reason.includes("Level 2 Argument Inspection")) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-900/60 text-purple-300 ring-1 ring-purple-500/40">
        Deep Block
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Modal({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl bg-gray-900 ring-1 ring-gray-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Request Detail</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-white hover:bg-gray-800 transition"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* High-level details */}
        <div className="px-6 py-4 grid grid-cols-2 gap-x-8 gap-y-3 border-b border-gray-800">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Timestamp</p>
            <p className="text-sm text-gray-200 font-[family-name:var(--font-geist-mono)]">
              {new Date(log.timestamp).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">IP Address</p>
            <p className="text-sm text-gray-200 font-[family-name:var(--font-geist-mono)]">{log.ip}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tool Name</p>
            <p className="text-sm font-[family-name:var(--font-geist-mono)]">
              {log.toolName ?? <span className="text-gray-500">—</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
            <StatusBadge status={log.status} reason={log.reason} />
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Reason</p>
            <p className="text-sm text-gray-300">{log.reason}</p>
          </div>
        </div>

        {/* Raw payload */}
        <div className="px-6 py-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Raw Payload</p>
          <pre className="rounded-lg bg-slate-950 ring-1 ring-gray-800 p-4 text-xs text-green-300 font-[family-name:var(--font-geist-mono)] overflow-auto max-h-64 whitespace-pre-wrap break-all">
            <code>{log.reason}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/logs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LogEntry[] = await res.json();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }, []);

  const pollLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      if (!res.ok) return;
      const data: LogEntry[] = await res.json();
      setLogs(data);
    } catch {
      // silent — don't surface transient poll errors
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const id = setInterval(pollLogs, 3000);
    return () => clearInterval(id);
  }, [pollLogs]);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Sentinel
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              AI Agent Security Gateway — MCP Request Log
            </p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 ring-1 ring-gray-700 transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4">
          {(["Allowed", "Blocked", "RateLimited"] as LogStatus[]).map((s) => {
            const count = logs.filter((l) => l.status === s).length;
            return (
              <div
                key={s}
                className="rounded-lg bg-gray-900 ring-1 ring-gray-800 px-4 py-3 flex flex-col gap-1"
              >
                <span className="text-xs text-gray-400">{STATUS_LABEL[s]}</span>
                <span className="text-2xl font-semibold text-white">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Control Bar */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search IP or Tool..."
            className="flex-1 rounded-md bg-gray-900 px-3 py-2 text-sm text-gray-200 ring-1 ring-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
          />
          <div className="flex items-center rounded-md ring-1 ring-gray-700 overflow-hidden text-sm font-medium">
            {(["All", "Allowed", "Blocked", "Rate Limited"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setStatusFilter(option)}
                className={`px-3 py-2 transition ${
                  statusFilter === option
                    ? "bg-gray-700 text-white"
                    : "bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {(() => {
          const q = searchQuery.toLowerCase();
          const filteredLogs = logs.filter((log) => {
            const matchesSearch =
              q === "" ||
              log.ip.toLowerCase().includes(q) ||
              (log.toolName ?? "").toLowerCase().includes(q);
            const matchesStatus =
              statusFilter === "All" ||
              (statusFilter === "Rate Limited"
                ? log.status === "RateLimited"
                : log.status === statusFilter);
            return matchesSearch && matchesStatus;
          });

          return (
            <div className="rounded-lg bg-gray-900 ring-1 ring-gray-800 overflow-hidden">
              {error ? (
                <p className="p-6 text-sm text-red-400">{error}</p>
              ) : logs.length === 0 && !loading ? (
                <p className="p-6 text-sm text-gray-500">
                  No logs found. Send a request to{" "}
                  <code className="text-gray-300">/api/mcp</code> to get started.
                </p>
              ) : filteredLogs.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">No logs match your current filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-left text-xs text-gray-400 uppercase tracking-wider">
                        <th className="px-4 py-3 font-medium">Time</th>
                        <th className="px-4 py-3 font-medium">IP Address</th>
                        <th className="px-4 py-3 font-medium">Tool Name</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {filteredLogs.map((log, i) => (
                        <tr
                          key={i}
                          onClick={() => setSelectedLog(log)}
                          className="cursor-pointer hover:bg-slate-800 transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap font-[family-name:var(--font-geist-mono)] text-xs">
                            {timeAgo(log.timestamp)}
                          </td>
                          <td className="px-4 py-3 text-gray-300 font-[family-name:var(--font-geist-mono)] text-xs">
                            {log.ip}
                          </td>
                          <td className="px-4 py-3 text-gray-100 font-[family-name:var(--font-geist-mono)] text-xs">
                            {log.toolName ?? <span className="text-gray-500">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={log.status} reason={log.reason} />
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                            {log.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        <p className="text-xs text-gray-600 text-right">
          Showing up to 100 most recent entries
        </p>
      </div>

      {selectedLog && (
        <Modal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </main>
  );
}
