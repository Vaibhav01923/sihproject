"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PracticeQuiz from "@/components/PracticeQuiz";

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

export default function StudioClient({
  documents,
  selectedId,
  questions,
  isAdmin,
}: {
  documents: Doc[];
  selectedId: string | null;
  questions: Q[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [count, setCount] = useState(8);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [practicing, setPracticing] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }

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
      let data: { id?: string; error?: string };
      try {
        data = await res.json();
      } catch {
        // A non-JSON body (e.g. a gateway timeout page) means the request
        // never made it to our own error handling - surface that plainly
        // instead of failing silently, which is what used to happen here.
        throw new Error(`The server didn't respond properly (status ${res.status}) - the file may be too large or slow to parse. Try a smaller file.`);
      }
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
        return;
      }
      router.push(`/studio?doc=${data.id}`);
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed - check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
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
      showToast(`Pushed successfully - ${data.published} question${data.published === 1 ? "" : "s"} published to iGOT Karmayogi.`);
      // router.refresh() re-renders this component with fresh server data,
      // which resets local state (including the toast) well before its
      // timeout - delay it so the toast is actually readable first.
      setTimeout(() => router.refresh(), 1800);
    } finally {
      setPublishing(false);
    }
  }

  function exportQti() {
    const items = questions
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

  const publishedCount = questions.filter((q) => q.status === "PUBLISHED").length;
  const pendingCount = questions.length - publishedCount;

  return (
    <>
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 50,
            background: "var(--sidebar)",
            color: "var(--sidebar-text)",
            borderRadius: 7,
            padding: "13px 18px",
            fontSize: 13.5,
            fontWeight: 500,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            maxWidth: 320,
          }}
        >
          {toast}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
        <aside className="card" style={{ padding: "20px 22px" }}>
        <h2 className="section-title" style={{ marginBottom: 14, fontSize: 15 }}>
          Source material
        </h2>
        <div
          onClick={() => !uploading && fileInput.current?.click()}
          style={{
            border: "1px dashed #c4c8bd",
            borderRadius: 6,
            padding: "20px 16px",
            textAlign: "center",
            background: "#fafbf8",
            cursor: uploading ? "default" : "pointer",
            opacity: uploading ? 0.75 : 1,
          }}
        >
          {uploading ? (
            <>
              <div className="spinner" style={{ margin: "0 auto 10px" }} />
              <div className="mono" style={{ fontSize: 10.5, color: "#8b8f86", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Uploading &amp; parsing…
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 6 }}>Large PDFs can take a little while.</div>
            </>
          ) : (
            <>
              <div className="mono" style={{ fontSize: 10.5, color: "#8b8f86", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Click to upload PDF / TXT
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, lineHeight: 1.5 }}>
                Circulars, instruction manuals, training notes
              </div>
            </>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          style={{ display: "none" }}
          onChange={upload}
          disabled={uploading}
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
            {questions.length > 0 && (
              <p style={{ fontSize: 11.5, color: "var(--ink-faint)", margin: "10px 0 0", lineHeight: 1.4 }}>
                Generating again replaces the current unpublished set for this document - already-published questions
                stay untouched.
              </p>
            )}
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
        ) : practicing ? (
          <PracticeQuiz questions={questions} onExit={() => setPracticing(false)} />
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 13.5, color: "var(--ink-muted)" }}>
                {questions.length} questions · {publishedCount} published
              </div>
              <div style={{ display: "flex", gap: 9 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setPracticing(true)}>
                  Practice quiz
                </button>
                <button className="btn btn-outline btn-sm" onClick={exportQti}>
                  Export QTI
                </button>
                <button
                  className="btn btn-dark btn-sm"
                  onClick={publish}
                  disabled={publishing || pendingCount === 0 || !isAdmin}
                  title={
                    !isAdmin
                      ? "Only an administrator can publish to iGOT Karmayogi"
                      : pendingCount === 0
                        ? "Everything here is already published"
                        : undefined
                  }
                >
                  {publishing ? "Publishing…" : "Publish to Karmayogi"}
                </button>
              </div>
            </div>
            {!isAdmin ? (
              <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "-6px 0 14px", textAlign: "right" }}>
                Publishing to iGOT Karmayogi is restricted to administrators - practicing is open to everyone.
              </p>
            ) : pendingCount === 0 ? (
              <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "-6px 0 14px", textAlign: "right" }}>
                Everything here is already published.
              </p>
            ) : null}
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
                  <div style={{ marginTop: 13, paddingTop: 12, borderTop: "1px solid #f1f2ed" }}>
                    <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>Maps to: {q.domainName ?? "General"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status !== "PUBLISHED") return null;
  return (
    <span style={{ color: "var(--blue)", fontWeight: 600 }}>
      · published
    </span>
  );
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}
