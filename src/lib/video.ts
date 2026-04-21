import { exec } from "child_process";
import { promisify } from "util";
import { writeFileSync } from "fs";
import { logger } from "./logger";

const execAsync = promisify(exec);

// Use bundled FFmpeg from npm instead of system install
function getFFmpegPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const installer = require("@ffmpeg-installer/ffmpeg");
    return installer.path;
  } catch {
    return "ffmpeg";
  }
}

const FFMPEG = getFFmpegPath();

/**
 * Tạo video từ 1 ảnh (Ken Burns zoom effect)
 */
export async function createVideoFromImage(
  inputImage: string,
  outputVideo: string,
  durationSec: number = 5
): Promise<void> {
  const frames = durationSec * 25;

  const cmd = [
    `"${FFMPEG}" -y`,
    `-loop 1 -i "${inputImage}"`,
    `-vf "zoompan=z='min(zoom+0.0008,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=25,fade=t=in:st=0:d=1,fade=t=out:st=${durationSec - 1}:d=1"`,
    `-t ${durationSec}`,
    `-c:v libx264 -pix_fmt yuv420p -preset fast`,
    `"${outputVideo}"`,
  ].join(" ");

  logger.info({ event: "video_creating", inputImage, durationSec });

  await execAsync(cmd, { timeout: 60000 });

  logger.info({
    event: "video_created_single",
    outputVideo,
    durationSec,
  });
}

/**
 * Tạo multi-slide video với Ken Burns per slide + crossfade transitions
 * Đây là function chính cho production
 */
export async function createMultiSlideVideo(
  images: string[],
  outputVideo: string,
  durationPerSlide: number = 3,
  crossfadeDuration: number = 0.5
): Promise<void> {
  if (images.length === 0) throw new Error("No images provided");

  if (images.length === 1) {
    return createVideoFromImage(images[0], outputVideo, durationPerSlide);
  }

  logger.info({
    event: "multi_slide_creating",
    count: images.length,
    durationPerSlide,
  });

  // Strategy: render each image as a short Ken Burns clip, then concat with crossfade
  const tempVideos: string[] = [];
  const frames = durationPerSlide * 25;

  // Create individual Ken Burns clips per slide
  for (let i = 0; i < images.length; i++) {
    const tempOut = images[i].replace(".png", "_clip.mp4");
    tempVideos.push(tempOut);

    // Alternate zoom direction per slide for variety
    const zoomIn = i % 2 === 0;
    const zoomFilter = zoomIn
      ? `zoompan=z='min(zoom+0.0006,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=25`
      : `zoompan=z='if(eq(on,1),1.08,max(zoom-0.0006,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=25`;

    const cmd = [
      `"${FFMPEG}" -y`,
      `-loop 1 -i "${images[i]}"`,
      `-vf "${zoomFilter}"`,
      `-t ${durationPerSlide}`,
      `-c:v libx264 -pix_fmt yuv420p -preset fast`,
      `"${tempOut}"`,
    ].join(" ");

    await execAsync(cmd, { timeout: 30000 });

    logger.info({
      event: "slide_clip_created",
      slide: i + 1,
      total: images.length,
    });
  }

  // Concat all clips with crossfade using xfade filter
  if (tempVideos.length === 2) {
    // Simple case: 2 videos
    const offset = durationPerSlide - crossfadeDuration;
    const cmd = [
      `"${FFMPEG}" -y`,
      `-i "${tempVideos[0]}" -i "${tempVideos[1]}"`,
      `-filter_complex "xfade=transition=fade:duration=${crossfadeDuration}:offset=${offset},format=yuv420p"`,
      `-c:v libx264 -pix_fmt yuv420p -preset fast -movflags +faststart`,
      `"${outputVideo}"`,
    ].join(" ");

    await execAsync(cmd, { timeout: 60000 });
  } else {
    // Multiple videos: chain xfade filters step by step
    // Each xfade shortens total by crossfadeDuration
    const inputs = tempVideos.map((v) => `-i "${v}"`).join(" ");
    let filterComplex = "";
    const offset = durationPerSlide - crossfadeDuration;

    // Build chain: [0:v][1:v]xfade=...[xf1]; [xf1][2:v]xfade=...[xf2]; etc.
    for (let i = 1; i < tempVideos.length; i++) {
      const inTag = i === 1 ? "[0:v]" : `[xf${i - 1}]`;
      const outTag = i === tempVideos.length - 1 ? "[outv]" : `[xf${i}]`;
      // Each subsequent xfade starts at: (first offset) + (i-1) * offset
      // But we must subtract accumulated crossfade durations
      const currentOffset = offset + (i - 1) * (durationPerSlide - crossfadeDuration) - (i - 1) * crossfadeDuration;

      filterComplex += `${inTag}[${i}:v]xfade=transition=fade:duration=${crossfadeDuration}:offset=${Math.max(0, currentOffset).toFixed(2)}${outTag}`;
      if (i < tempVideos.length - 1) filterComplex += ";";
    }

    const cmd = [
      `"${FFMPEG}" -y`,
      inputs,
      `-filter_complex "${filterComplex}"`,
      `-map "[outv]"`,
      `-c:v libx264 -pix_fmt yuv420p -preset fast -movflags +faststart`,
      `"${outputVideo}"`,
    ].join(" ");

    await execAsync(cmd, { timeout: 120000 });
  }

  // Cleanup temp clips
  for (const temp of tempVideos) {
    try {
      require("fs").unlinkSync(temp);
    } catch {
      // ignore cleanup errors
    }
  }

  logger.info({
    event: "multi_slide_video_created",
    count: images.length,
    outputVideo,
  });
}

/**
 * Tạo slideshow từ nhiều ảnh (simple concat, no Ken Burns)
 */
export async function createSlideshow(
  images: string[],
  outputVideo: string,
  durationPerSlide: number = 3
): Promise<void> {
  const listContent = images
    .map((img) => `file '${img}'\nduration ${durationPerSlide}`)
    .join("\n");

  const finalContent = listContent + `\nfile '${images[images.length - 1]}'`;

  const listFile = "ffmpeg-images.txt";
  writeFileSync(listFile, finalContent);

  const cmd = [
    `"${FFMPEG}" -y`,
    `-f concat -safe 0 -i "${listFile}"`,
    `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p"`,
    `-c:v libx264 -pix_fmt yuv420p -preset fast`,
    `-movflags +faststart`,
    `"${outputVideo}"`,
  ].join(" ");

  logger.info({ event: "slideshow_creating", count: images.length });

  await execAsync(cmd, { timeout: 120000 });

  logger.info({
    event: "video_created_slideshow",
    count: images.length,
    outputVideo,
  });
}

/**
 * Add audio vào video (loop audio, trim to video length)
 */
export async function addAudio(
  inputVideo: string,
  audioFile: string,
  outputVideo: string
): Promise<void> {
  const cmd = [
    `"${FFMPEG}" -y`,
    `-i "${inputVideo}" -i "${audioFile}"`,
    `-c:v copy -c:a aac -b:a 128k`,
    `-shortest`,
    `"${outputVideo}"`,
  ].join(" ");

  await execAsync(cmd, { timeout: 60000 });

  logger.info({
    event: "video_with_audio",
    outputVideo,
  });
}
