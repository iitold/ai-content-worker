# AI Content Worker

Tự động sinh video/ảnh nội dung tech từ trends → Supabase. Chạy được trên **Mac và Windows**.

## Yêu cầu duy nhất

- **Node.js 18+** — Tải tại [nodejs.org](https://nodejs.org)

## Cài đặt (3 bước)

```bash
# 1. Clone repo
git clone https://github.com/iitold/ai-content-worker
cd ai-content-worker

# 2. Tạo file .env
# Mac/Linux:
cp .env.example .env
# Windows CMD:
copy .env.example .env

# 3. Cài dependencies (tự động cài Playwright Chromium)
npm install
```

## Cấu hình

Mở file `.env` và điền vào:

```env
GEMINI_API_KEY=your_gemini_api_key_here    # https://aistudio.google.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ...your_anon_key_here      # Supabase → Settings → API
```

## Chạy

```bash
npm start
```

Worker sẽ tự động:
1. Kiểm tra bảng `job_queue` trên Supabase mỗi 30 giây
2. Khi có job mới → chạy pipeline đầy đủ
3. Upload kết quả lên Supabase Storage
4. Dashboard tại [viviral.vercel.app](https://viviral.vercel.app) hiển thị kết quả

## Kết quả mỗi job

- 📸 Infographic PNG (1080×1920)
- 🎬 Video MP4 với Ken Burns + crossfade
- 💾 Lưu vào Supabase `contents` table

## Pipeline

```
Hacker News + Reddit trends
         ↓
    Gemini AI picks best topic
         ↓
    Generate content + outline
         ↓
    Render HTML → PNG slides (Playwright)
         ↓
    Create MP4 video (FFmpeg — built-in)
         ↓
    Upload → Supabase Storage
         ↓
    Save → Supabase Database
```

## Trigger job từ Dashboard

Vào [viviral.vercel.app/dashboard/jobs](https://viviral.vercel.app/dashboard/jobs) → bấm **"▶ Run Pipeline"**.

Worker sẽ tự nhận job sau tối đa 30 giây.

## Config AI Models

Chỉnh file `config/models.json` để thay đổi model AI hoặc thứ tự fallback.
