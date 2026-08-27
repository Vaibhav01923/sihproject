"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GeneratePathButton({ label = "Regenerate path" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      await fetch("/api/path/generate", { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-primary" onClick={run} disabled={loading}>
      {loading ? "Generating…" : label}
    </button>
  );
}
