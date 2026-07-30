import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUTPUT_DIR = path.resolve("outputs");
const PPT_PATH = path.join(OUTPUT_DIR, "tutor-text-diff-presentation-en.pptx");
const PREVIEW_DIR = path.join(OUTPUT_DIR, "tutor-ppt-preview-en");

const COLORS = {
  white: "#FFFFFF",
  ink: "#111111",
  body: "#333333",
  muted: "#666666",
  panel: "#F2F2F2",
  rule: "#D4D7DC",
  accent: "#0B2545",
};

function textbox(
  slide,
  { left, top, width, height, text, fontSize, bold = false, color = COLORS.ink, align = "left" }
) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontFace: "Helvetica Neue",
    fontSize,
    bold,
    color,
    alignment: align,
  };
  return shape;
}

function panel(slide, { left, top, width, height, fill = COLORS.panel, lineFill = COLORS.rule }) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: 1 },
  });
}

function addSlideNumber(slide, number) {
  textbox(slide, {
    left: 1184,
    top: 659,
    width: 54,
    height: 25,
    text: String(number),
    fontSize: 15,
    color: COLORS.muted,
    align: "right",
  });
}

function addTitle(slide, eyebrow, title, subtitle) {
  textbox(slide, {
    left: 56,
    top: 36,
    width: 280,
    height: 24,
    text: eyebrow,
    fontSize: 14,
    bold: true,
    color: COLORS.muted,
  });
  textbox(slide, {
    left: 56,
    top: 72,
    width: 860,
    height: 72,
    text: title,
    fontSize: 40,
    bold: true,
    color: COLORS.ink,
  });
  textbox(slide, {
    left: 56,
    top: 154,
    width: 860,
    height: 48,
    text: subtitle,
    fontSize: 21,
    color: COLORS.body,
  });
}

function createSlideBase(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.white;
  return slide;
}

function slideOne(presentation) {
  const slide = createSlideBase(presentation);
  addTitle(
    slide,
    "Tutor demo",
    "Text Diff in Dynamic History",
    "A practical rich-text diff pipeline for Confluence version comparison"
  );

  textbox(slide, {
    left: 56,
    top: 264,
    width: 720,
    height: 126,
    text: "Key idea\nThis project does not rely on one diff function.\nIt combines preprocessing, block alignment, type-specific comparison, and UI-friendly output.",
    fontSize: 28,
    color: COLORS.accent,
  });

  const boxes = [
    { title: "Input", body: "Confluence storage HTML\nOld version vs current version" },
    { title: "Goal", body: "Readable, stable, and safe comparison" },
    { title: "Output", body: "Rendered HTML\nStructured blocks\nSummary counters" },
  ];

  let top = 94;
  for (const box of boxes) {
    panel(slide, { left: 866, top, width: 334, height: 140 });
    textbox(slide, {
      left: 888,
      top: top + 18,
      width: 140,
      height: 24,
      text: box.title,
      fontSize: 18,
      bold: true,
      color: COLORS.muted,
    });
    textbox(slide, {
      left: 888,
      top: top + 54,
      width: 270,
      height: 64,
      text: box.body,
      fontSize: 23,
      color: COLORS.ink,
    });
    top += 156;
  }

  addSlideNumber(slide, 1);
}

function slideTwo(presentation) {
  const slide = createSlideBase(presentation);
  addTitle(
    slide,
    "Pipeline",
    "Five processing layers",
    "Each layer reduces complexity or improves readability before the UI renders the result."
  );

  const steps = [
    ["1 Preprocess", "Expand links, code macros, emoticons, and image attachments."],
    ["2 Split", "Convert the page into comparable blocks such as paragraphs, headings, lists, tables, and code blocks."],
    ["3 Align", "Run block-level LCS over oldBlocks and currentBlocks."],
    ["4 Compare", "Choose inline diff, line diff, or table-specific diff based on content type."],
    ["5 Return", "Build HTML, structured blocks, summary counters, and limited flags."],
  ];

  const left = 56;
  const top = 254;
  const width = 216;
  const height = 240;
  const gap = 16;

  steps.forEach(([title, body], index) => {
    const x = left + index * (width + gap);
    panel(slide, { left: x, top, width, height });
    textbox(slide, {
      left: x + 16,
      top: top + 18,
      width: width - 32,
      height: 34,
      text: title,
      fontSize: 24,
      bold: true,
      color: COLORS.ink,
    });
    textbox(slide, {
      left: x + 16,
      top: top + 66,
      width: width - 32,
      height: 144,
      text: body,
      fontSize: 17,
      color: COLORS.body,
    });
  });

  addSlideNumber(slide, 2);
}

function slideThree(presentation) {
  const slide = createSlideBase(presentation);
  addTitle(
    slide,
    "Diff strategies",
    "One project, several comparison modes",
    "The implementation uses different granularity for different content types."
  );

  const blocks = [
    ["Block alignment", "Block-level LCS decides same, added, removed, and modified sections."],
    ["Inline token diff", "Small and medium text uses token-level LCS for additions and deletions inside one block."],
    ["Long-text fallback", "Large text falls back to sentence or line-level comparison before local inline diff."],
    ["Code and tables", "Code blocks are compared line by line. Tables use cell-level diff when shape matches, or side-by-side view when shape changes."],
  ];

  blocks.forEach(([title, body], index) => {
    const x = 56 + (index % 2) * 584;
    const y = 252 + Math.floor(index / 2) * 178;
    panel(slide, { left: x, top: y, width: 528, height: 136 });
    textbox(slide, {
      left: x + 16,
      top: y + 18,
      width: 240,
      height: 26,
      text: title,
      fontSize: 24,
      bold: true,
      color: COLORS.accent,
    });
    textbox(slide, {
      left: x + 16,
      top: y + 52,
      width: 490,
      height: 66,
      text: body,
      fontSize: 18,
      color: COLORS.body,
    });
  });

  addSlideNumber(slide, 3);
}

function slideFour(presentation) {
  const slide = createSlideBase(presentation);
  textbox(slide, {
    left: 56,
    top: 36,
    width: 280,
    height: 24,
    text: "Supporting operations",
    fontSize: 14,
    bold: true,
    color: COLORS.muted,
  });
  textbox(slide, {
    left: 56,
    top: 72,
    width: 980,
    height: 110,
    text: "The algorithm works because the engineering around it is solid",
    fontSize: 36,
    bold: true,
    color: COLORS.ink,
  });
  textbox(slide, {
    left: 56,
    top: 186,
    width: 980,
    height: 42,
    text: "Data preparation, HTML normalization, safety checks, and UI fallback are all part of the solution.",
    fontSize: 20,
    color: COLORS.body,
  });

  const items = [
    ["Data fetching", "src/index.js fetches page versions, attachment URLs, and author names."],
    ["HTML normalization", "prepareConfluenceHtml expands storage-format constructs before comparison."],
    ["Safe rendering", "Allowed tags and attributes are filtered so risky values do not reach the preview."],
    ["UI fallback", "ComparisonPanel catches rendering failures and shows a safe message instead of breaking the page."],
  ];

  items.forEach(([title, body], index) => {
    const x = 56;
    const y = 246 + index * 98;
    panel(slide, { left: x, top: y, width: 1144, height: 78, fill: "#F6F6F6" });
    textbox(slide, {
      left: x + 18,
      top: y + 16,
      width: 220,
      height: 24,
      text: title,
      fontSize: 22,
      bold: true,
      color: COLORS.ink,
    });
    textbox(slide, {
      left: x + 260,
      top: y + 16,
      width: 840,
      height: 42,
      text: body,
      fontSize: 19,
      color: COLORS.body,
    });
  });

  addSlideNumber(slide, 4);
}

function slideFive(presentation) {
  const slide = createSlideBase(presentation);
  addTitle(
    slide,
    "Conclusion",
    "Why this design is practical",
    "The value comes from combining classic diff ideas with real product constraints."
  );

  const points = [
    "Readable: users can understand rich-text changes instead of reading raw storage markup.",
    "Stable: large content triggers safer fallback paths instead of freezing the browser.",
    "Specialized: code blocks and tables are handled in ways that preserve structure.",
    "Product-ready: fetching, sanitization, rendering, summaries, and fallback behavior are all connected.",
  ];

  panel(slide, { left: 56, top: 244, width: 1144, height: 282 });
  points.forEach((point, index) => {
    textbox(slide, {
      left: 92,
      top: 272 + index * 58,
      width: 1040,
      height: 30,
      text: `${index + 1}. ${point}`,
      fontSize: 23,
      color: COLORS.ink,
    });
  });

  textbox(slide, {
    left: 56,
    top: 572,
    width: 980,
    height: 46,
    text: "In one sentence: the project turns a classic LCS-style idea into a usable rich-text diff feature.",
    fontSize: 24,
    bold: true,
    color: COLORS.accent,
  });

  addSlideNumber(slide, 5);
}

async function writeBlob(targetPath, blob) {
  await fs.writeFile(targetPath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: 1280, height: 720 },
  });

  slideOne(presentation);
  slideTwo(presentation);
  slideThree(presentation);
  slideFour(presentation);
  slideFive(presentation);

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await writeBlob(path.join(PREVIEW_DIR, `${stem}.png`), png);
  }

  const montage = await presentation.export({
    format: "webp",
    montage: true,
    scale: 1,
  });
  await writeBlob(path.join(PREVIEW_DIR, "deck-montage.webp"), montage);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(PPT_PATH);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
