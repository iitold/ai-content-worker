import "dotenv/config";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "./lib/logger";
import { claimJob, completeJob, failJob, uploadFile, saveContent } from "./lib/supabase";
import { fetchTrends } from "./lib/trends";
import { selectTopics, generateContent } from "./lib/content";
import { renderHTMLToImage, renderMultipleSlides } from "./lib/renderer";
import { createMultiSlideVideo } from "./lib/video";

// html-generator is copied from original — needed for slide/infographic HTML
import { generateHTML, generateSlides } from "./lib/html-generator";

const OUTPUT_DIR = join(process.cwd(), "output");
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS ?? "30000", 10);

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Pipeline ─────────────────────────────────────────────────────────────────

async function runPipeline(jobId: string): Promise<Record<string, unknown>> {
  const jobDir = join(OUTPUT_DIR, `job_${jobId}`);
  if (!existsSync(jobDir)) mkdirSync(jobDir, { recursive: true });

  logger.info({ event: "pipeline_start", jobId });

  // Step 1: Trends
  logger.info({ event: "step", jobId, step: "1/6 fetch trends" });
  const trends = await fetchTrends();

  // Step 2: Topic selection
  logger.info({ event: "step", jobId, step: "2/6 select topic" });
  const topics = await selectTopics(trends);
  const topic = topics[0];
  logger.info({ event: "topic_chosen", title: topic.title, angle: topic.angle });

  // Step 3: Content generation
  logger.info({ event: "step", jobId, step: "3/6 generate content" });
  const ai = await generateContent(topic);

  // Step 4: Render slides → PNG
  logger.info({ event: "step", jobId, step: "4/6 render slides" });
  const slides = generateSlides({ title: ai.outline.title, sections: ai.outline.sections, content: ai.content });
  const infographicHtml = generateHTML({ title: ai.outline.title, sections: ai.outline.sections, content: ai.content });
  const slidePaths = await renderMultipleSlides(slides, jobDir, "slide");
  const infographicPath = join(jobDir, "infographic.png");
  await renderHTMLToImage(infographicHtml, infographicPath);

  // Step 5: Create video
  logger.info({ event: "step", jobId, step: "5/6 create video" });
  const videoPath = join(jobDir, "video.mp4");
  await createMultiSlideVideo(slidePaths, videoPath, 3, 0.5);

  // Step 6: Upload to Supabase
  logger.info({ event: "step", jobId, step: "6/6 upload & save" });
  const imageUrl = await uploadFile(infographicPath, `jobs/${jobId}/infographic.png`);
  const videoUrl = await uploadFile(videoPath, `jobs/${jobId}/video.mp4`);

  const contentId = await saveContent({
    title: ai.outline.title,
    topic_angle: topic.angle,
    content: ai.content,
    caption: ai.caption,
    image_url: imageUrl,
    video_url: videoUrl,
    source_trends: trends.slice(0, 5).map((t) => t.title),
    status: "completed",
    metadata: { jobId, slideCount: slides.length },
  });

  return { topic: topic.title, contentId, imageUrl, videoUrl, slideCount: slides.length };
}

// ─── Poll Loop ────────────────────────────────────────────────────────────────

async function poll() {
  const job = await claimJob();
  if (!job) return; // No pending jobs

  logger.info({ event: "job_claimed", jobId: job.id });
  const start = Date.now();

  try {
    const result = await runPipeline(job.id);
    await completeJob(job.id, { ...result, totalMs: Date.now() - start });
    logger.info({ event: "job_done", jobId: job.id, totalMs: Date.now() - start });
  } catch (err) {
    const error = (err as Error).message;
    await failJob(job.id, error);
    logger.error({ event: "job_error", jobId: job.id, error });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 AI Content Worker started");
  console.log(`   Supabase: ${process.env.SUPABASE_URL ?? "⚠ not configured"}`);
  console.log(`   Poll interval: ${POLL_INTERVAL / 1000}s`);
  console.log(`   Output dir: ${OUTPUT_DIR}\n`);

  // Check required env vars
  const required = ["GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ Missing required env vars: ${missing.join(", ")}`);
    console.error("   Copy .env.example to .env and fill in the values.");
    process.exit(1);
  }

  // Authenticate to bypass RLS
  await import("./lib/supabase").then((m) => m.authenticateWorker());
  console.log("✅ Worker authenticated successfully");

  // Send initial heartbeat, then loop every 10s
  const { sendHeartbeat } = await import("./lib/supabase");
  await sendHeartbeat();
  setInterval(() => sendHeartbeat().catch(() => {}), 10000);

  console.log("✅ Config OK — polling for jobs...\n");

  // Run immediately on start, then on interval
  await poll();
  setInterval(poll, POLL_INTERVAL);
}

main().catch((err) => {
  logger.error({ event: "fatal", error: err.message });
  process.exit(1);
});
