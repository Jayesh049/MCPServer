export type FreeLlmProvider = "groq" | "gemini" | "none";

export type FreeLlmChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function providerChain(): FreeLlmProvider[] {
  const chain: FreeLlmProvider[] = [];
  if (process.env.GROQ_API_KEY?.trim()) chain.push("groq");
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) chain.push("gemini");
  return chain;
}

async function callGroq(system: string, user: string): Promise<string> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new Error("GROQ_API_KEY is not set.");
  const model = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  const raw = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Groq error (${res.status}): ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set.");
  const model = process.env.GEMINI_GENERATE_MODEL?.trim() || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    key
  )}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${system}\n\nUSER_REQUEST:\n${user}` }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1400
      }
    })
  });
  const raw = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Gemini error (${res.status}): ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text.trim();
}

export async function synthesizeFreeLlm(system: string, user: string): Promise<{
  provider: FreeLlmProvider;
  text: string;
  lastError?: string;
}> {
  const chain = providerChain();
  let lastError: string | undefined;
  for (const p of chain) {
    try {
      const text = p === "groq" ? await callGroq(system, user) : await callGemini(system, user);
      if (text.trim()) return { provider: p, text: text.trim() };
      lastError = `${p}: empty response`;
    } catch (e: any) {
      lastError = e?.message ? String(e.message) : String(e);
    }
  }
  return { provider: "none", text: "", lastError };
}

