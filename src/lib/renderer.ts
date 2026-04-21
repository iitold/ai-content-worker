import { chromium } from "playwright";
import { logger } from "./logger";


/**
 * Render single HTML to PNG
 */
export async function renderHTMLToImage(
  html: string,
  outputPath: string
): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
  });

  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: outputPath,
    fullPage: false,
  });

  await browser.close();

  logger.info({
    event: "image_rendered",
    outputPath,
  });
}

/**
 * Render multiple HTML slides to PNGs (reuses single browser instance)
 * Returns array of output file paths
 */
export async function renderMultipleSlides(
  htmlSlides: string[],
  outputDir: string,
  prefix: string = "slide"
): Promise<string[]> {
  const browser = await chromium.launch();
  const outputPaths: string[] = [];

  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1920 },
    });

    for (let i = 0; i < htmlSlides.length; i++) {
      await page.setContent(htmlSlides[i], { waitUntil: "networkidle" });
      await page.waitForTimeout(400);

      const outputPath = `${outputDir}/${prefix}_${String(i).padStart(2, "0")}.png`;
      await page.screenshot({
        path: outputPath,
        fullPage: false,
      });

      outputPaths.push(outputPath);

      logger.info({
        event: "slide_rendered",
        slide: i + 1,
        total: htmlSlides.length,
        outputPath,
      });
    }
  } finally {
    await browser.close();
  }

  logger.info({
    event: "all_slides_rendered",
    count: outputPaths.length,
    outputDir,
  });

  return outputPaths;
}
