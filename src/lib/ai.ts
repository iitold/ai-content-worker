import axios, { AxiosError } from "axios";
import { readFileSync } from "fs";
import { join } from "path";
import { logger } from "./logger";

export type TaskType = "short" | "outline" | "long";

export interface AIResult {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
}

interface ModelsConfig {
  routing: Record<TaskType, { providers: string[]; timeoutMs: number; maxRetries: number }>;
  providers: Record<string, { models: Record<TaskType, string[]> }>;
}

function loadConfig(): ModelsConfig {
  const raw = readFileSync(join(process.cwd(), "config/models.json"), "utf-8");
  return JSON.parse(raw);
}

async function callGemini(model: string, input: string, timeoutMs: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await axios.post(url, { contents: [{ parts: [{ text: input }] }] }, { timeout: timeoutMs });
  return res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenAI(model: string, input: string, timeoutMs: number): Promise<string> {
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    { model, messages: [{ role: "user", content: input }] },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: timeoutMs }
  );
  return res.data?.choices?.[0]?.message?.content ?? "";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateText(taskType: TaskType, input: string): Promise<AIResult> {
  const config = loadConfig();
  const routing = config.routing[taskType];

  for (const providerName of routing.providers) {
    const models = config.providers[providerName]?.models[taskType] ?? [];
    for (const model of models) {
      for (let attempt = 1; attempt <= routing.maxRetries; attempt++) {
        const start = Date.now();
        try {
          let text = "";
          if (providerName === "gemini") text = await callGemini(model, input, routing.timeoutMs);
          else if (providerName === "openai") text = await callOpenAI(model, input, routing.timeoutMs);
          if (!text.trim()) throw new Error("empty_response");
          const latencyMs = Date.now() - start;
          logger.info({ event: "ai_success", provider: providerName, model, taskType, latencyMs });
          return { text, provider: providerName, model, latencyMs };
        } catch (err) {
          const error = err instanceof AxiosError
            ? `${err.response?.status ?? "timeout"}`
            : (err as Error).message;
          logger.warn({ event: "ai_failed", provider: providerName, model, attempt, error });
          if (attempt < routing.maxRetries) await sleep(2000 * 2 ** attempt);
        }
      }
    }
  }
  throw new Error("AllProvidersFailedError");
}
