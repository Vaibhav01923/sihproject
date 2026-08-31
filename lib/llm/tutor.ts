import OpenAI from "openai";
import { llmAvailable, splitSentences } from "./quizgen";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export type ChatTurn = { role: "USER" | "ASSISTANT"; content: string };

export async function answerFromDocument(
  documentText: string,
  filename: string,
  question: string,
  history: ChatTurn[]
): Promise<{ answer: string; grounded: boolean }> {
  if (llmAvailable()) {
    try {
      return { answer: await answerWithLLM(documentText, filename, question, history), grounded: true };
    } catch (err) {
      console.error("AI tutor LLM call failed, falling back to keyword search:", err);
    }
  }
  return { answer: answerWithKeywordSearch(documentText, question), grounded: false };
}

async function answerWithLLM(documentText: string, filename: string, question: string, history: ChatTurn[]) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const truncated = documentText.slice(0, 60000);

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are an AI tutor helping an official in India's statistical system study one uploaded document ("${filename}"). Ground your answers in the source material below - don't invent facts about this specific document that aren't in it. You may use general knowledge to explain a term, acronym, or concept the document uses or assumes (e.g. defining "SaaS" if the document mentions it without defining it itself) - that's helping the reader understand the document, not guessing about it. Only say the material doesn't cover something when it's actually asking about content the document doesn't touch at all.\n\nSOURCE MATERIAL:\n"""\n${truncated}\n"""`,
      },
      ...history.map((h) => ({ role: h.role === "USER" ? ("user" as const) : ("assistant" as const), content: h.content })),
      { role: "user" as const, content: question },
    ],
  });

  return completion.choices[0]?.message.content ?? "I couldn't generate a response.";
}

// Fallback with no API key configured: return the sentences from the
// document that best overlap the question's keywords, so the feature still
// does something genuinely useful rather than a canned "unavailable" reply.
function answerWithKeywordSearch(documentText: string, question: string): string {
  const stop = new Set("the a an of to and in on for is are was were be been what how why does do explain describe tell me about which".split(" "));
  const qWords = (question.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !stop.has(w));
  if (qWords.length === 0) {
    return "I need an API key (OPENAI_API_KEY) configured to have a real conversation about this document. In the meantime, try asking with a more specific keyword and I'll search the text for it.";
  }

  const sentences = splitSentences(documentText);
  const scored = sentences
    .map((s) => ({ s, score: qWords.reduce((n, w) => n + (s.toLowerCase().includes(w) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return `No OPENAI_API_KEY is configured, so I can't reason about this freely - and a plain keyword search for "${qWords.join(", ")}" didn't turn up a match in the document either. Try rephrasing, or set OPENAI_API_KEY for a real conversational answer.`;
  }

  const quotes = scored.map((x) => `"${x.s.trim()}"`).join("\n\n");
  return `No OPENAI_API_KEY is configured, so this is a plain keyword search rather than a reasoned answer. Closest matching passages in the document:\n\n${quotes}`;
}
