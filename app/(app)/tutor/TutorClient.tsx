"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { id: string; role: "USER" | "ASSISTANT"; content: string };
type Doc = { id: string; filename: string };

export default function TutorClient({ documents, selectedId, initialMessages }: { documents: Doc[]; selectedId: string | null; initialMessages: Msg[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const selected = documents.find((d) => d.id === selectedId) ?? null;

  async function send() {
    if (!input.trim() || !selected) return;
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "USER", content: text }]);
    setSending(true);
    try {
      const res = await fetch(`/api/documents/${selected.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((m) => [...m, data.message]);
      }
    } finally {
      setSending(false);
    }
  }

  if (documents.length === 0) {
    return <div className="empty-state">Upload and parse a document in Quiz Studio first, then come back here to ask questions about it.</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "start" }}>
      <aside className="card" style={{ padding: "16px 18px" }}>
        <h2 className="section-title" style={{ marginBottom: 12, fontSize: 15 }}>
          Documents
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {documents.map((d) => (
            <div
              key={d.id}
              onClick={() => router.push(`/tutor?doc=${d.id}`)}
              style={{
                fontSize: 13.5,
                padding: "8px 10px",
                borderRadius: 5,
                cursor: "pointer",
                background: d.id === selected?.id ? "var(--blue-tint)" : "transparent",
                color: d.id === selected?.id ? "var(--blue)" : "var(--ink)",
                fontWeight: d.id === selected?.id ? 600 : 400,
              }}
            >
              {d.filename}
            </div>
          ))}
        </div>
      </aside>

      <section className="card" style={{ display: "flex", flexDirection: "column", height: 560 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontSize: 13.5, fontWeight: 600 }}>
          {selected?.filename}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.length === 0 && (
            <div style={{ color: "var(--ink-muted)", fontSize: 14 }}>Ask anything about this document to get started.</div>
          )}
          {messages.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "USER" ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "80%",
                  fontSize: 14,
                  lineHeight: 1.5,
                  padding: "10px 14px",
                  borderRadius: 8,
                  whiteSpace: "pre-wrap",
                  background: m.role === "USER" ? "var(--sidebar)" : "#f1f2ed",
                  color: m.role === "USER" ? "#fff" : "var(--ink)",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && <div style={{ color: "var(--ink-faint)", fontSize: 13 }}>Thinking…</div>}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask anything about your document…"
            style={{ flex: 1, fontSize: 14, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 6 }}
          />
          <button className="btn btn-primary" onClick={send} disabled={sending || !input.trim()}>
            Send
          </button>
        </div>
      </section>
    </div>
  );
}
