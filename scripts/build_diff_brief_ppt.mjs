import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUTPUT_DIR = path.resolve("outputs");
const PPT_PATH = path.join(OUTPUT_DIR, "text-diff-algorithm-demo.pptx");
const PREVIEW_DIR = path.join(OUTPUT_DIR, "ppt-preview");

const COLORS = {
  white: "#FFFFFF",
  ink: "#000000",
  body: "#222222",
  muted: "#555555",
  panel: "#EDEDED",
  rule: "#B8BCC4",
  accent: "#FF6B35",
  blue: "#0B2545",
};

function textbox(slide, { left, top, width, height, text, fontSize, bold = false, color = COLORS.ink, align = "left" }) {
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
    left: 42,
    top: 34,
    width: 320,
    height: 24,
    text: eyebrow,
    fontSize: 14,
    bold: true,
    color: COLORS.muted,
  });
  textbox(slide, {
    left: 42,
    top: 72,
    width: 760,
    height: 84,
    text: title,
    fontSize: 38,
    bold: true,
    color: COLORS.ink,
  });
  textbox(slide, {
    left: 42,
    top: 162,
    width: 760,
    height: 56,
    text: subtitle,
    fontSize: 20,
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
    "3-minute technical brief",
    "文本差异算法与配套操作",
    "基于 Dynamic History 代码实现：面向 Confluence 富文本的分层 diff 流水线"
  );

  textbox(slide, {
    left: 42,
    top: 278,
    width: 688,
    height: 150,
    text: "核心判断\n这不是一个单点 diff 函数，而是“预处理 + 块级对齐 + 类型化细分比对 + 汇总渲染”的工程化组合。",
    fontSize: 28,
    bold: false,
    color: COLORS.blue,
  });

  const cards = [
    { title: "输入", body: "Confluence storage HTML\nold vs current" },
    { title: "重点", body: "可读性、稳定性、性能保护" },
    { title: "输出", body: "html + blocks + summary" },
  ];

  let top = 90;
  for (const card of cards) {
    const left = 818;
    panel(slide, { left, top, width: 380, height: 154 });
    textbox(slide, {
      left: left + 22,
      top: top + 22,
      width: 120,
      height: 26,
      text: card.title,
      fontSize: 18,
      bold: true,
      color: COLORS.muted,
    });
    textbox(slide, {
      left: left + 22,
      top: top + 62,
      width: 320,
      height: 70,
      text: card.body,
      fontSize: 24,
      color: COLORS.ink,
    });
    top += 172;
  }

  textbox(slide, {
    left: 42,
    top: 510,
    width: 730,
    height: 92,
    text: "讲法建议：先讲整体链路，再讲 4 个特化 diff，最后补上附件解析、安全渲染、性能阈值和兜底策略。",
    fontSize: 22,
    color: COLORS.body,
  });

  addSlideNumber(slide, 1);
}

function slideTwo(presentation) {
  const slide = createSlideBase(presentation);
  addTitle(
    slide,
    "Pipeline",
    "主流程：五层处理链",
    "每一层都在降低复杂度或提升可读性，最后再把结果交给 UI。"
  );

  const steps = [
    ["1 预处理", "prepareConfluenceHtml\n展开链接 / code 宏 / 图片附件\n过滤危险标签与属性"],
    ["2 拆块", "extractDiffBlocks\n按段落、标题、列表、表格、代码块等生成 block"],
    ["3 对齐", "buildRichTextDiffHtml\n对 oldBlocks / currentBlocks 做块级 LCS"],
    ["4 细分", "普通文本 -> token diff\n代码 -> line diff\n表格 -> cell 或并排展示"],
    ["5 汇总", "buildDiffResult\n产出 html、blocks、summary、limited"],
  ];

  const y = 270;
  const width = 220;
  const gap = 20;
  steps.forEach(([title, body], index) => {
    const left = 42 + index * (width + gap);
    panel(slide, { left, top: y, width, height: 240 });
    textbox(slide, {
      left: left + 16,
      top: y + 18,
      width: width - 32,
      height: 40,
      text: title,
      fontSize: 24,
      bold: true,
      color: COLORS.ink,
    });
    textbox(slide, {
      left: left + 16,
      top: y + 72,
      width: width - 32,
      height: 138,
      text: body,
      fontSize: 18,
      color: COLORS.body,
    });
    if (index < steps.length - 1) {
      textbox(slide, {
        left: left + width + 2,
        top: y + 98,
        width: 16,
        height: 40,
        text: ">",
        fontSize: 24,
        bold: true,
        color: COLORS.muted,
        align: "center",
      });
    }
  });

  addSlideNumber(slide, 2);
}

function slideThree(presentation) {
  const slide = createSlideBase(presentation);
  addTitle(
    slide,
    "Algorithms",
    "关键算法：经典 LCS + 类型化特化",
    "重点不在重新发明 diff，而在把不同内容类型放到合适的比较粒度上。"
  );

  const blocks = [
    ["块级 LCS", "oldBlocks × currentBlocks\n阈值: 120000\n决定 same / added / removed / modified"],
    ["行内 token diff", "splitInlineDiffUnits\n中英文字、标点、空白拆分\n阈值: 80000"],
    ["长文本 fallback", "splitSentenceUnits\n先句/行级，再对子段做 inline diff\n避免浏览器冻结"],
    ["代码/表格特化", "代码按行保留缩进\n表格同形状做 cell diff\n异形状并排展示"],
  ];

  blocks.forEach(([title, body], index) => {
    const left = 42 + (index % 2) * 598;
    const top = 250 + Math.floor(index / 2) * 190;
    panel(slide, { left, top, width: 556, height: 150 });
    textbox(slide, {
      left: left + 18,
      top: top + 18,
      width: 240,
      height: 30,
      text: title,
      fontSize: 24,
      bold: true,
      color: COLORS.ink,
    });
    textbox(slide, {
      left: left + 18,
      top: top + 58,
      width: 510,
      height: 74,
      text: body,
      fontSize: 19,
      color: COLORS.body,
    });
  });

  addSlideNumber(slide, 3);
}

function slideFour(presentation) {
  const slide = createSlideBase(presentation);
  addTitle(
    slide,
    "Operations",
    "配套操作：让 diff 真正可上线",
    "真正把用户体验撑起来的，除了算法，还有输入准备、渲染安全和失败兜底。"
  );

  const items = [
    ["数据准备", "src/index.js 拉取页面版本、附件 URL、作者名，保证前端拿到完整比较输入。"],
    ["宏与附件展开", "链接、code 宏、image 宏先转换成可渲染 HTML；附件按文件名解析真实下载地址。"],
    ["安全渲染", "限制 allowedTags / allowedAttrs，补全相对链接，屏蔽 javascript: 之类风险输入。"],
    ["汇总与提示", "ComparisonPanel 读取 summary，显示 additions、removals、modified blocks 与 limited 提示。"],
    ["样式层配合", "styles.css 区分 block、inline、code line、table panel，让变更一眼能看懂。"],
    ["异常兜底", "diff 渲染失败时退回安全提示，而不是让整个比较面板崩掉。"],
  ];

  items.forEach(([title, body], index) => {
    const left = index < 3 ? 42 : 650;
    const top = 228 + (index % 3) * 146;
    panel(slide, { left, top, width: 548, height: 118, fill: "#F4F4F4" });
    textbox(slide, {
      left: left + 16,
      top: top + 14,
      width: 180,
      height: 26,
      text: title,
      fontSize: 22,
      bold: true,
      color: COLORS.blue,
    });
    textbox(slide, {
      left: left + 16,
      top: top + 44,
      width: 500,
      height: 56,
      text: body,
      fontSize: 17,
      color: COLORS.body,
    });
  });

  addSlideNumber(slide, 4);
}

function slideFive(presentation) {
  const slide = createSlideBase(presentation);
  addTitle(
    slide,
    "Demo",
    "1 页示例 + 结论",
    "最后用一句示例把“块级 + 行内 + 特化处理”串起来，方便收尾。"
  );

  panel(slide, { left: 42, top: 236, width: 380, height: 294 });
  panel(slide, { left: 448, top: 236, width: 380, height: 294 });
  panel(slide, { left: 854, top: 236, width: 348, height: 294 });

  textbox(slide, {
    left: 60,
    top: 256,
    width: 140,
    height: 24,
    text: "Before",
    fontSize: 20,
    bold: true,
    color: COLORS.muted,
  });
  textbox(slide, {
    left: 60,
    top: 296,
    width: 320,
    height: 192,
    text: "段落：支持旧版 storage 格式\n代码块：仅按原样渲染\n表格：结构变化容易难读",
    fontSize: 24,
    color: COLORS.ink,
  });

  textbox(slide, {
    left: 466,
    top: 256,
    width: 140,
    height: 24,
    text: "After",
    fontSize: 20,
    bold: true,
    color: COLORS.muted,
  });
  textbox(slide, {
    left: 466,
    top: 296,
    width: 320,
    height: 192,
    text: "段落：+ 行内高亮新增 / 删除\n代码块：按行 diff，保留缩进\n表格：同形状高亮 cell，异形状并排",
    fontSize: 24,
    color: COLORS.ink,
  });

  textbox(slide, {
    left: 876,
    top: 262,
    width: 280,
    height: 40,
    text: "Takeaway",
    fontSize: 26,
    bold: true,
    color: COLORS.ink,
  });
  textbox(slide, {
    left: 876,
    top: 318,
    width: 280,
    height: 176,
    text: "这套实现最有价值的地方，是把经典 LCS 思路和富文本预处理、性能保护、前端可视化结合成了一个能稳定工作的工程方案。",
    fontSize: 22,
    color: COLORS.body,
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
