import axios from "axios";
import { logger } from "./logger";

export interface TrendItem {
  keyword:   string;
  title:     string;
  source:    "hackernews" | "reddit";
  score:     number;
  url:       string;
  timestamp: number;
}

const HN_TECH_KEYWORDS = [
  "llm", "ai", "gpt", "claude", "gemini", "agent", "rust", "golang",
  "typescript", "wasm", "kubernetes", "docker", "rag", "vector db",
  "open source", "api", "model", "inference", "fine-tune", "benchmark",
];

async function fetchHackerNews(): Promise<TrendItem[]> {
  const { data: ids } = await axios.get<number[]>(
    "https://hacker-news.firebaseio.com/v0/topstories.json",
    { timeout: 8000 }
  );
  const top50 = ids.slice(0, 50);
  const chunks: number[][] = [];
  for (let i = 0; i < top50.length; i += 10) chunks.push(top50.slice(i, i + 10));

  const items: TrendItem[] = [];
  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((id) =>
        axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 5000 })
      )
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const story = r.value.data;
      if (!story?.title || story.type !== "story") continue;
      const titleLower = (story.title as string).toLowerCase();
      const keyword = HN_TECH_KEYWORDS.find((kw) => titleLower.includes(kw));
      if (!keyword) continue;
      items.push({
        keyword,
        title: story.title,
        source: "hackernews",
        score: story.score ?? 0,
        url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
        timestamp: (story.time ?? 0) * 1000,
      });
    }
  }
  logger.info({ event: "hn_fetch_done", count: items.length });
  return items;
}

const TECH_SUBREDDITS = ["MachineLearning", "LocalLLaMA", "artificial", "programming", "webdev", "devops"];

async function fetchReddit(): Promise<TrendItem[]> {
  const items: TrendItem[] = [];
  for (const subreddit of TECH_SUBREDDITS) {
    try {
      const { data } = await axios.get(
        `https://www.reddit.com/r/${subreddit}/hot.json?limit=10`,
        { timeout: 8000, headers: { "User-Agent": "ai-content-worker/1.0" } }
      );
      for (const post of data?.data?.children ?? []) {
        const p = post.data;
        if (!p?.title || p.stickied || p.score < 50) continue;
        const titleLower = (p.title as string).toLowerCase();
        const keyword = HN_TECH_KEYWORDS.find((kw) => titleLower.includes(kw)) ?? subreddit.toLowerCase();
        items.push({
          keyword, title: p.title, source: "reddit",
          score: p.score ?? 0,
          url: `https://reddit.com${p.permalink}`,
          timestamp: (p.created_utc ?? 0) * 1000,
        });
      }
    } catch (err) {
      logger.warn({ event: "reddit_fetch_failed", subreddit, error: (err as Error).message });
    }
  }
  return items;
}

export async function fetchTrends(): Promise<TrendItem[]> {
  const [hn, reddit] = await Promise.allSettled([fetchHackerNews(), fetchReddit()]);
  const all: TrendItem[] = [
    ...(hn.status === "fulfilled" ? hn.value : []),
    ...(reddit.status === "fulfilled" ? reddit.value : []),
  ];
  const map = new Map<string, TrendItem>();
  for (const item of all) {
    const key = item.keyword.toLowerCase().trim();
    const ex = map.get(key);
    if (!ex || item.score > ex.score) map.set(key, { ...item, keyword: key });
  }
  const ranked = Array.from(map.values()).sort((a, b) => b.score - a.score);
  logger.info({ event: "trend_fetch_done", total: ranked.length });
  return ranked;
}
