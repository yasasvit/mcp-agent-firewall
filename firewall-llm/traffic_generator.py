import random
import time

import requests

URL = "https://mcp-agent-firewall-rdc2plx8i-yasasvits-projects.vercel.app/api/simulate"

FAKE_IPS = [
    "104.28.14.2",
    "89.123.45.6",
    "185.220.101.34",
    "72.14.192.50",
    "51.77.203.117",
    "203.0.113.42",
    "198.51.100.77",
    "45.33.32.156",
    "167.99.182.31",
    "91.108.4.220",
]

SCENARIOS = [
    ("safe",           "Safe Query"),
    ("path_traversal", "Path Traversal"),
    ("obfuscated",     "Obfuscated Payload"),
    ("jailbreak",      "Jailbreak Attempt"),
]

for i in range(1, 16):
    ip = random.choice(FAKE_IPS)
    scenario_id, scenario_label = random.choice(SCENARIOS)

    cache_buster = int(time.time() * 1000)
    payload = {"scenario": scenario_id, "cache_buster": cache_buster}
    headers = {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
    }

    try:
        res = requests.post(f"{URL}?t={cache_buster}", json=payload, headers=headers, timeout=30)
        data = res.json()
        status = "ALLOWED" if data.get("allowed") else "BLOCKED"
        reason = data.get("blockReason") or "—"
        latency = data.get("latencyMs", "?")
        print(f"[{i:02d}] {ip:<18} | {scenario_label:<22} | {status:<7} | {reason} ({latency}ms)")
    except requests.exceptions.RequestException as e:
        print(f"[{i:02d}] {ip:<18} | {scenario_label:<22} | ERROR   | {e}")

    time.sleep(1)

print("\nDone — 15 synthetic requests sent.")
