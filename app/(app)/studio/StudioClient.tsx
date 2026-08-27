"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Doc = { id: string; filename: string; pageCount: number | null; conceptCount: number | null; status: string };
type Q = {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  difficulty: string;
  page: number | null;
  status: string;
  generatedBy: string;
  domainName: string | null;
};

export default function StudioClient({ documents, selectedId, questions }: { documents: Doc[]; selectedId: string | null; questions: Q[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [count, setCount] = useState(8);
  const [publishing, setPublishing] = useState(false);

  const selected = documents.find((d) => d.id === selectedId) ?? null;

  async function upload() {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
        return;
      }
      router.push(`/studio?doc=${data.id}`);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    if (!selected) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/documents/${selected.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? "Generation failed");
        return;
      }
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function review(id: string, status: "APPROVED" | "REJECTED") {
    await fetch(`/api/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function publish() {
    if (!selected) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/documents/${selected.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Publish failed");
        return;
      }
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  function exportQti() {
    const approved = questions.filter((q) => q.status === "APPROVED" || q.status === "PUBLISHED");
    const items = approved
      .map(
        (q, i) => `  <assessmentItem identifier="Q${i + 1}" title="${escapeXml(q.text.slice(0, 40))}" adaptive="false" timeDependent="false">
    <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
      <correctResponse><value>${"ABCD"[q.correctIndex]}</value></correctResponse>
    </responseDeclaration>
    <itemBody>
      <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
        <prompt>${escapeXml(q.text)}</prompt>
${q.options.map((o, oi) => `        <simpleChoice identifier="${"ABCD"[oi]}">${escapeXml(o)}</simpleChoice>`).join("\n")}
      </choiceInteraction>
    </itemBody>
  </assessmentItem>`
      )
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="${selected?.id ?? "quiz"}" title="${escapeXml(selected?.filename ?? "Quiz")}">\n${items}\n</assessmentTest>\n`;

    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(selected?.filename ?? "quiz").replace(/\.[^.]+$/, "")}.qti.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const approvedCount = questions.filter((q) => q.status === "APPROVED").length;
  const publishedCount = questions.filter((q) => q.status === "PUBLISHED").length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
      <aside className="card" style={{ padding: "20px 22px" }}>
        <h2 className="section-title" style={{ marginBottom: 14, fontSize: 15 }}>
          Source material
        </h2>
        <div
          onClick={() => fileInput.current?.click()}
          style={{ border: "1px dashed #c4c8bd", borderRadius: 6, padding: "20px 16px", textAlign: "center", background: "#fafbf8", cursor: "pointer" }}
        >
          <div className="mono" style={{ fontSize: 10.5, color: "#8b8f86", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {uploading ? "Uploading…" : "Click to upload PDF / TXT"}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, lineHeight: 1.5 }}>
            Circulars, instruction manuals, training notes
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          style={{ display: "none" }}
          onChange={upload}
        />
        {uploadError && <div className="form-error" style={{ marginTop: 12, marginBottom: 0 }}>{uploadError}</div>}

        {documents.length > 0 && (
          <div className="field" style={{ marginTop: 16, marginBottom: 0 }}>
            <label htmlFor="docSwitch">Document</label>
            <select
              id="docSwitch"
              value={selected?.id ?? ""}
              onChange={(e) => {
                router.push(`/studio?doc=${e.target.value}`);
              }}
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
          </div>
        )}

        {selected && (
          <div style={{ marginTop: 14, border: "1px solid #e6e7e1", borderRadius: 6, padding: "12px 13px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{selected.filename}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "#8b8f86", marginTop: 5 }}>
              {[selected.pageCount ? `${selected.pageCount} pages` : null, "parsed", selected.conceptCount ? `${selected.conceptCount} concepts` : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        )}

        {selected && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5 }}>
                <span style={{ color: "#4a4f47" }}>Question count</span>
                <input
                  type="number"
                  min={3}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  style={{ width: 56, textAlign: "right", fontFamily: "var(--mono)", fontSize: 12.5, border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span style={{ color: "#4a4f47" }}>Competency mapping</span>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
                  Automatic
                </span>
              </div>
            </div>
            {genError && <div className="form-error" style={{ marginTop: 12, marginBottom: 0 }}>{genError}</div>}
            <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={generate} disabled={generating}>
              {generating ? "Generating…" : "Generate questions"}
            </button>
          </>
        )}
      </aside>

      <section>
        {!selected ? (
          <div className="empty-state">Upload a document to get started.</div>
        ) : generating ? (
          <div className="card" style={{ padding: "60px 24px", textAlign: "center" }}>
            <div className="spinner" />
            <div style={{ fontSize: 14, color: "var(--ink-muted)", marginTop: 16 }}>Reading the document, extracting testable concepts…</div>
          </div>
        ) : questions.length === 0 ? (
          <div className="empty-state">No questions generated yet for this document.</div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 13.5, color: "var(--ink-muted)" }}>
                {questions.length} questions · {approvedCount} approved · {publishedCount} published
              </div>
              <div style={{ display: "flex", gap: 9 }}>
                <button className="btn btn-outline btn-sm" onClick={exportQti} disabled={approvedCount + publishedCount === 0}>
                  Export QTI
                </button>
                <button className="btn btn-dark btn-sm" onClick={publish} disabled={publishing || approvedCount === 0}>
                  {publishing ? "Publishing…" : "Publish to Karmayogi"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {questions.map((q) => (
                <div key={q.id} className="card rise" style={{ padding: "18px 20px" }}>
                  <div className="mono" style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
                    <span>{q.difficulty}</span>
                    {q.page && (
                      <>
                        <span>·</span>
                        <span>p. {q.page}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{q.generatedBy.startsWith("llm") ? "AI generated" : "heuristic"}</span>
                    <StatusBadge status={q.status} />
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.45, marginTop: 9 }}>{q.text}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 13 }}>
                    {q.options.map((o, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 9,
                          fontSize: 13.5,
                          border: `1px solid ${i === q.correctIndex ? "var(--green)" : "#eceee8"}`,
                          background: i === q.correctIndex ? "var(--green-tint)" : "#fbfcfa",
                          borderRadius: 5,
                          padding: "9px 12px",
                          lineHeight: 1.4,
                        }}
                      >
                        <span className="mono" style={{ fontSize: 11.5, color: "#8b8f86" }}>
                          {"ABCD"[i]}
                        </span>
                        <span>{o}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 13, paddingTop: 12, borderTop: "1px solid #f1f2ed" }}>
                    <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>Maps to: {q.domainName ?? "General"}</span>
                    {q.status === "DRAFT" && (
                      <div style={{ display: "flex", gap: 14, fontSize: 13, fontWeight: 600 }}>
                        <span style={{ color: "var(--ink-faint)", cursor: "pointer" }} onClick={() => review(q.id, "REJECTED")}>
                          Reject
                        </span>
                        <span style={{ color: "var(--green)", cursor: "pointer" }} onClick={() => review(q.id, "APPROVED")}>
                          Approve
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "DRAFT") return null;
  const color = status === "PUBLISHED" ? "var(--blue)" : status === "APPROVED" ? "var(--green)" : "var(--red)";
  return (
    <span style={{ color, fontWeight: 600 }}>
      · {status.toLowerCase()}
    </span>
  );
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}
