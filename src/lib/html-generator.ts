export interface InfographicData {
  title: string;
  sections: string[];
  content: string;
}

export interface SlideData {
  title: string;
  sections: string[];
  content: string;
}

// ─── Slide Gradients (different per slide for variety) ───────────────────────

const SLIDE_THEMES = [
  { bg: "linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #020617 100%)", accent: "#818cf8" },
  { bg: "linear-gradient(160deg, #0c1222 0%, #1a2744 50%, #0a0f1a 100%)", accent: "#60a5fa" },
  { bg: "linear-gradient(160deg, #0f1b12 0%, #14352a 50%, #040d08 100%)", accent: "#34d399" },
  { bg: "linear-gradient(160deg, #1a1006 0%, #2d1f0e 50%, #0d0903 100%)", accent: "#fbbf24" },
  { bg: "linear-gradient(160deg, #1a0a14 0%, #2d1225 50%, #0d0509 100%)", accent: "#f472b6" },
  { bg: "linear-gradient(160deg, #120a1e 0%, #1f1438 50%, #08040f 100%)", accent: "#a78bfa" },
];

function slideBaseCSS(theme: typeof SLIDE_THEMES[0]): string {
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px;
    height: 1920px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: ${theme.bg};
    color: #e2e8f0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .slide {
    padding: 80px;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  `;
}

const GOOGLE_FONT_LINK = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">`;

/**
 * Generate title slide (slide 0)
 */
function generateTitleSlide(title: string): string {
  const theme = SLIDE_THEMES[0];
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>${GOOGLE_FONT_LINK}
<style>
  ${slideBaseCSS(theme)}
  .badge {
    display: inline-block;
    background: ${theme.accent}22;
    color: ${theme.accent};
    font-size: 20px; font-weight: 600;
    padding: 12px 28px; border-radius: 100px;
    letter-spacing: 3px; text-transform: uppercase;
    margin-bottom: 40px;
  }
  h1 {
    font-size: 72px; font-weight: 800; line-height: 1.1;
    background: linear-gradient(135deg, #ffffff, #94a3b8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 32px;
  }
  .subtitle {
    font-size: 28px; color: #94a3b8; line-height: 1.5;
  }
  .footer {
    position: absolute; bottom: 60px; left: 80px; right: 80px;
    display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid rgba(255,255,255,0.06); padding-top: 24px;
  }
  .footer-brand { font-size: 20px; font-weight: 600; color: ${theme.accent}; }
  .footer-date { font-size: 18px; color: #475569; }
</style></head>
<body><div class="slide">
  <div class="badge">Trending Tech</div>
  <h1>${title}</h1>
  <p class="subtitle">Key takeaways you need to know</p>
  <div class="footer">
    <span class="footer-brand">AI Content Factory</span>
    <span class="footer-date">${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
  </div>
</div></body></html>`;
}

/**
 * Generate section slide
 */
function generateSectionSlide(
  sectionTitle: string,
  sectionContent: string,
  index: number,
  total: number
): string {
  const theme = SLIDE_THEMES[(index + 1) % SLIDE_THEMES.length];
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>${GOOGLE_FONT_LINK}
<style>
  ${slideBaseCSS(theme)}
  .slide-number {
    font-size: 120px; font-weight: 800;
    color: ${theme.accent}15; position: absolute;
    top: 60px; right: 80px; line-height: 1;
  }
  .progress {
    display: flex; gap: 8px; margin-bottom: 48px;
  }
  .progress-dot {
    width: 40px; height: 6px; border-radius: 3px;
    background: rgba(255,255,255,0.1);
  }
  .progress-dot.active {
    background: ${theme.accent};
  }
  h2 {
    font-size: 56px; font-weight: 800; line-height: 1.15;
    margin-bottom: 40px;
    background: linear-gradient(135deg, #ffffff, ${theme.accent});
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .content {
    font-size: 32px; line-height: 1.7; color: #cbd5e1;
  }
  .divider {
    width: 80px; height: 4px; border-radius: 2px;
    background: ${theme.accent}; margin-bottom: 40px;
  }
  .footer {
    position: absolute; bottom: 60px; left: 80px; right: 80px;
    display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid rgba(255,255,255,0.06); padding-top: 24px;
  }
  .footer-brand { font-size: 18px; font-weight: 600; color: ${theme.accent}; }
  .footer-counter { font-size: 18px; color: #475569; }
</style></head>
<body>
  <div class="slide">
    <div class="slide-number">${String(index + 1).padStart(2, "0")}</div>
    <div class="progress">
      ${Array.from({ length: total }, (_, i) =>
        `<div class="progress-dot${i <= index ? " active" : ""}"></div>`
      ).join("")}
    </div>
    <div class="divider"></div>
    <h2>${sectionTitle}</h2>
    <p class="content">${sectionContent}</p>
    <div class="footer">
      <span class="footer-brand">AI Content Factory</span>
      <span class="footer-counter">${index + 1} / ${total}</span>
    </div>
  </div>
</body></html>`;
}

/**
 * Generate outro/CTA slide
 */
function generateOutroSlide(title: string): string {
  const theme = SLIDE_THEMES[0];
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>${GOOGLE_FONT_LINK}
<style>
  ${slideBaseCSS(theme)}
  .slide { text-align: center; align-items: center; }
  .icon { font-size: 80px; margin-bottom: 32px; }
  h2 {
    font-size: 52px; font-weight: 800; line-height: 1.2;
    background: linear-gradient(135deg, #ffffff, ${theme.accent});
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 24px;
  }
  .cta {
    font-size: 28px; color: #94a3b8;
    margin-bottom: 48px;
  }
  .brand {
    display: inline-block;
    background: ${theme.accent}22; color: ${theme.accent};
    font-size: 22px; font-weight: 700;
    padding: 16px 40px; border-radius: 100px;
  }
</style></head>
<body><div class="slide">
  <div class="icon">🔥</div>
  <h2>Follow for more<br/>tech insights</h2>
  <p class="cta">Like & share if this was useful</p>
  <div class="brand">AI Content Factory</div>
</div></body></html>`;
}

/**
 * Generate all slides for multi-slide video
 * Returns array of HTML strings: [title, section1, section2, ..., outro]
 */
export function generateSlides(data: SlideData): string[] {
  const { title, sections, content } = data;
  const slides: string[] = [];

  // Title slide
  slides.push(generateTitleSlide(title));

  // Section slides
  const sectionCount = Math.min(sections.length, 5);
  for (let i = 0; i < sectionCount; i++) {
    const sectionContent = extractSectionContent(content, sections[i]);
    slides.push(
      generateSectionSlide(
        sections[i],
        sectionContent || "A critical insight that every developer should understand about this evolving technology landscape.",
        i,
        sectionCount
      )
    );
  }

  // Outro slide
  slides.push(generateOutroSlide(title));

  return slides;
}

function extractSectionContent(content: string, section: string): string {
  // tìm đoạn text liên quan đến section trong content
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const sectionLower = section.toLowerCase();

  // tìm line chứa section title, lấy line tiếp theo làm content
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(sectionLower)) {
      // lấy đoạn text sau section header (tối đa 2 dòng)
      const nextLines = lines
        .slice(i + 1, i + 3)
        .filter((l) => !l.startsWith("#") && !l.startsWith("**"))
        .join(" ");
      if (nextLines.trim()) return nextLines.trim();
      return lines[i].replace(/^#+\s*/, "").replace(/\*\*/g, "");
    }
  }

  return "";
}

export function generateHTML(data: InfographicData): string {
  const { title, sections, content } = data;

  const sectionHtml = sections
    .slice(0, 5)
    .map((sec, idx) => {
      const text = extractSectionContent(content, sec);
      const iconColors = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa"];
      const color = iconColors[idx % iconColors.length];

      return `
        <div class="card">
          <div class="card-header">
            <div class="card-number" style="background: ${color}20; color: ${color}">${String(idx + 1).padStart(2, "0")}</div>
            <h2>${sec}</h2>
          </div>
          <p>${text || "Key insight about this topic that drives engagement and learning."}</p>
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    width: 1080px;
    height: 1920px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #020617 100%);
    color: #e2e8f0;
    overflow: hidden;
  }

  .container {
    padding: 60px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .badge {
    display: inline-block;
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
    font-size: 16px;
    font-weight: 600;
    padding: 8px 20px;
    border-radius: 100px;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 24px;
  }

  h1 {
    font-size: 52px;
    font-weight: 800;
    margin-bottom: 16px;
    line-height: 1.15;
    background: linear-gradient(135deg, #ffffff, #94a3b8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 20px;
    color: #94a3b8;
    margin-bottom: 40px;
    line-height: 1.5;
  }

  .cards {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 28px 32px;
    backdrop-filter: blur(10px);
    transition: all 0.3s;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
  }

  .card-number {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .card h2 {
    font-size: 24px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .card p {
    font-size: 18px;
    line-height: 1.6;
    color: #94a3b8;
    margin-left: 60px;
  }

  .footer {
    margin-top: auto;
    padding-top: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .footer-brand {
    font-size: 18px;
    font-weight: 600;
    color: #6366f1;
  }

  .footer-date {
    font-size: 16px;
    color: #475569;
  }
</style>
</head>

<body>
  <div class="container">
    <div class="badge">Trending Tech</div>
    <h1>${title}</h1>
    <p class="subtitle">Key takeaways you need to know</p>

    <div class="cards">
      ${sectionHtml}
    </div>

    <div class="footer">
      <span class="footer-brand">AI Content Factory</span>
      <span class="footer-date">${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
    </div>
  </div>
</body>
</html>
`;
}
