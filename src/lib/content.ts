import { generateText } from "./ai";
import { logger } from "./logger";
import type { TrendItem } from "./trends";

export interface SelectedTopic {
  title: string;
  angle: string;
  audience: string;
}

export async function selectTopics(trends: TrendItem[]): Promise<SelectedTopic[]> {
  const list = trends.slice(0, 20).map((t, i) => `${i + 1}. ${t.title}`).join("\n");
  const prompt = `
You are a senior tech content strategist.
From the trending topics below, select the TOP 3 topics with highest viral potential.
Rules: Focus on AI, dev tools, engineering trends. Avoid duplicates.
Return ONLY valid JSON. No explanation.
[{ "title": "...", "angle": "...", "audience": "..." }]
Trending topics:\n${list}`;

  const res = await generateText("short", prompt);
  const cleaned = res.text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);
  logger.info({ event: "topics_selected", count: parsed.length });
  return parsed;
}

export interface Outline { title: string; sections: string[]; }
export interface GeneratedContent { outline: Outline; content: string; caption: string; }

export async function generateContent(topic: SelectedTopic): Promise<GeneratedContent> {
  const outlineRes = await generateText("outline", `
Create a structured outline for this tech topic:
Title: ${topic.title} | Angle: ${topic.angle}
Return ONLY valid JSON: { "title": "...", "sections": ["...", "..."] }
Rules: 4-6 sections, concise, technical`);

  const cleaned = outlineRes.text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const outline: Outline = JSON.parse(cleaned);

  const contentRes = await generateText("long", `
Write a technical article.
Title: ${outline.title}
Sections:\n${outline.sections.map((s, i) => `${i + 1}. ${s}`).join("\n")}
Style: developer tone, concise, insightful, no fluff, max 300 words`);

  const captionRes = await generateText("short", `
Write a short tech caption for social media.
Topic: ${topic.title}
Rules: under 2 sentences, engaging, opinionated. Return ONLY the caption text.`);

  return { outline, content: contentRes.text, caption: captionRes.text };
}
