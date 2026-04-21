import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { basename } from "path";
import { logger } from "./logger";

// ─── Client ──────────────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_KEY must be set in .env");
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}

export async function authenticateWorker() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.WORKER_EMAIL || "admin@viviral.com",
    password: process.env.WORKER_PASSWORD || "admin_password",
  });
  if (error) {
    throw new Error(`Worker Auth Failed: ${error.message}. Please check credentials or RLS policies.`);
  }
}

export async function sendHeartbeat() {
  const supabase = getSupabase();
  await supabase
    .from("settings")
    .upsert({ key: "worker_status", value: { last_seen: new Date().toISOString() } });
}


// ─── Job Queue ───────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  status: string;
  triggered_by: string;
  created_at: string;
}

/** Pick the oldest pending job and mark it as running */
export async function claimJob(): Promise<Job | null> {
  const supabase = getSupabase();

  // Select oldest pending job
  const { data, error } = await supabase
    .from("job_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null; // No pending jobs

  // Mark as running
  await supabase
    .from("job_queue")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", data.id)
    .eq("status", "pending"); // race-safe

  return data as Job;
}

export async function completeJob(jobId: string, result: Record<string, unknown>) {
  const supabase = getSupabase();
  await supabase
    .from("job_queue")
    .update({ status: "done", finished_at: new Date().toISOString(), result })
    .eq("id", jobId);
  logger.info({ event: "job_complete", jobId });
}

export async function failJob(jobId: string, error: string) {
  const supabase = getSupabase();
  await supabase
    .from("job_queue")
    .update({ status: "failed", finished_at: new Date().toISOString(), error })
    .eq("id", jobId);
  logger.error({ event: "job_failed", jobId, error });
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const BUCKET = "content-factory";

export async function uploadFile(localPath: string, storagePath?: string): Promise<string> {
  const supabase = getSupabase();
  const fileName = storagePath ?? `${Date.now()}_${basename(localPath)}`;
  const fileBuffer = readFileSync(localPath);
  const ext = localPath.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "mp4" ? "video/mp4" :
    ext === "png" ? "image/png" :
    "application/octet-stream";

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, fileBuffer, { contentType, upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  logger.info({ event: "file_uploaded", storagePath: fileName });
  return urlData.publicUrl;
}

// ─── Database ────────────────────────────────────────────────────────────────

export interface ContentRecord {
  title: string;
  topic_angle: string;
  content: string;
  caption: string;
  image_url: string;
  video_url: string;
  source_trends: string[];
  status: "completed" | "failed";
  metadata: Record<string, unknown>;
}

export async function saveContent(record: ContentRecord): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("contents")
    .insert({ ...record, created_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(`DB insert failed: ${error.message}`);
  logger.info({ event: "content_saved", id: data.id, title: record.title });
  return data.id;
}
