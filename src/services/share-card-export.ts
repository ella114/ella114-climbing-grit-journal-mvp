import Taro from "@tarojs/taro";
import { MetricResult, ShareCard } from "@/types/domain";

export const SHARE_CARD_CANVAS_ID = "share-card-export-canvas";
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440;
const PADDING = 84;
const CONTENT_WIDTH = CARD_WIDTH - PADDING * 2;

function drawRoundedCard(ctx: Taro.CanvasContext, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();
}

function formatValue(value: unknown, fallback = "未记录") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
}

function setFont(ctx: Taro.CanvasContext, size: number, weight = "400", family = "PingFang SC") {
  const fontFamily = family.includes(" ") ? `"${family}"` : family;
  ctx.font = `${weight} ${size}px ${fontFamily}, Helvetica, sans-serif`;
  ctx.setFontSize(size);
}

function wrapText(ctx: Taro.CanvasContext, text: string, maxWidth: number) {
  const lines: string[] = [];
  let current = "";

  for (const char of text) {
    const next = `${current}${char}`;
    const metrics = ctx.measureText(next);

    if (metrics.width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawWrappedText(
  ctx: Taro.CanvasContext,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
) {
  const wrapped = wrapText(ctx, text, maxWidth);
  wrapped.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight);
  });
  return wrapped.length * lineHeight;
}

function drawStatBox(ctx: Taro.CanvasContext, x: number, y: number, width: number, label: string, value: string | number) {
  ctx.setFillStyle("rgba(255, 255, 255, 0.68)");
  drawRoundedCard(ctx, x, y, width, 150, 24);
  ctx.setStrokeStyle("rgba(47, 38, 33, 0.10)");
  ctx.setLineWidth(2);
  ctx.strokeRect(x + 2, y + 2, width - 4, 146);

  ctx.setFillStyle("#7B695D");
  setFont(ctx, 24, "500");
  ctx.fillText(label, x + 28, y + 44);

  ctx.setFillStyle("#2F2621");
  setFont(ctx, 46, "800", "Georgia");
  drawWrappedText(ctx, String(value), x + 28, y + 112, width - 56, 46);
}

function drawMetricRow(ctx: Taro.CanvasContext, y: number, title: string, value: string) {
  ctx.setStrokeStyle("rgba(47, 38, 33, 0.14)");
  ctx.setLineWidth(2);
  ctx.beginPath();
  ctx.moveTo(PADDING, y - 28);
  ctx.lineTo(CARD_WIDTH - PADDING, y - 28);
  ctx.stroke();

  ctx.setFillStyle("#7B695D");
  setFont(ctx, 26, "500");
  ctx.fillText(title, PADDING, y);

  ctx.setFillStyle("#2F2621");
  setFont(ctx, 30, "700");
  ctx.fillText(value, CARD_WIDTH - PADDING - ctx.measureText(value).width, y);
}

async function drawShareCardToCanvas(card: ShareCard, canvasId: string) {
  const ctx = Taro.createCanvasContext(canvasId);
  const accent = card.type === "weekly_growth" ? "#AD6B32" : "#1F5C49";
  const warm = card.type === "session_recap" ? "#C96D42" : "#AD6B32";

  const background = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  background.addColorStop(0, "#FFF7EC");
  background.addColorStop(0.58, "#EFE4D6");
  background.addColorStop(1, "#DCEFE7");
  ctx.setFillStyle(background);
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.setFillStyle("rgba(173, 107, 50, 0.16)");
  ctx.save();
  ctx.translate(920, 120);
  ctx.rotate(0.32);
  ctx.fillRect(0, 0, 180, 680);
  ctx.restore();

  ctx.setFillStyle("rgba(31, 92, 73, 0.10)");
  ctx.save();
  ctx.translate(-70, 980);
  ctx.rotate(-0.24);
  ctx.fillRect(0, 0, 280, 520);
  ctx.restore();

  ctx.setFillStyle("rgba(255, 250, 244, 0.86)");
  drawRoundedCard(ctx, 46, 46, CARD_WIDTH - 92, CARD_HEIGHT - 92, 44);

  ctx.setStrokeStyle("rgba(31, 92, 73, 0.20)");
  ctx.setLineWidth(3);
  ctx.strokeRect(76, 76, CARD_WIDTH - 152, CARD_HEIGHT - 152);

  ctx.setFillStyle(accent);
  setFont(ctx, 30, "800");
  ctx.fillText(card.type === "project_send" ? "GRIT JOURNAL" : "CLIMBING GRIT", PADDING, 142);

  const kicker = card.type === "project_send" ? "PROJECT SEND" : card.type === "weekly_growth" ? "WEEKLY GROWTH" : "SESSION RECAP";
  ctx.setFillStyle(warm);
  setFont(ctx, 30, "800");
  ctx.fillText(kicker, PADDING, 250);

  ctx.setFillStyle("#2F2621");
  setFont(ctx, 76, "800", "Georgia");
  let offsetY = 345;
  offsetY += drawWrappedText(ctx, card.title, PADDING, offsetY, CONTENT_WIDTH, 90);

  if (card.type === "project_send") {
    ctx.setFillStyle(accent);
    setFont(ctx, 48, "500", "Kaiti SC");
    ctx.fillText("Sent with grit", PADDING, offsetY + 24);
    offsetY += 78;
  }

  const statWidth = (CONTENT_WIDTH - 28 * 2) / 3;
  const statY = Math.max(610, offsetY + 34);

  if (card.type === "project_send") {
    const data = card.data as {
      gradeLabel?: string;
      totalAttempts?: number;
      totalSessions?: number;
      sentDate?: string;
      fearDelta?: string;
    };

    drawStatBox(ctx, PADDING, statY, statWidth, "难度", formatValue(data.gradeLabel));
    drawStatBox(ctx, PADDING + statWidth + 28, statY, statWidth, "累计尝试", data.totalAttempts ?? 0);
    drawStatBox(ctx, PADDING + (statWidth + 28) * 2, statY, statWidth, "Session", data.totalSessions ?? 0);

    offsetY = statY + 230;
    ctx.setFillStyle("#2F2621");
    setFont(ctx, 34, "500");
    offsetY += drawWrappedText(ctx, card.subtitle ?? "真正的进步，不只发生在最后一步。", PADDING + 26, offsetY, CONTENT_WIDTH - 52, 52);

    ctx.setFillStyle("#7B695D");
    setFont(ctx, 28, "500");
    ctx.fillText(`${formatValue(data.sentDate)} · 恐惧变化 ${formatValue(data.fearDelta, "数据不足")}`, PADDING, CARD_HEIGHT - 142);
  } else if (card.type === "weekly_growth") {
    const data = card.data as {
      weeklySessionCount?: number;
      weeklyClimbCount?: number;
      activeProjectCount?: number;
      summary?: string;
      metrics?: MetricResult[];
    };

    drawStatBox(ctx, PADDING, statY, statWidth, "Session", data.weeklySessionCount ?? 0);
    drawStatBox(ctx, PADDING + statWidth + 28, statY, statWidth, "Climb", data.weeklyClimbCount ?? 0);
    drawStatBox(ctx, PADDING + (statWidth + 28) * 2, statY, statWidth, "Active Project", data.activeProjectCount ?? 0);

    offsetY = statY + 230;
    ctx.setFillStyle("#2F2621");
    setFont(ctx, 34, "500");
    offsetY += drawWrappedText(ctx, data.summary ?? "", PADDING + 26, offsetY, CONTENT_WIDTH - 52, 52);

    (data.metrics ?? []).slice(0, 4).forEach((metric, index) => {
      drawMetricRow(ctx, offsetY + 76 + index * 72, metric.title, metric.value);
    });
  } else {
    const data = card.data as {
      locationName?: string;
      discipline?: string;
      climbCount?: number;
      sessionCount?: number;
      highestGrade?: string;
      totalAttempts?: number;
      summary?: string;
    };

    drawStatBox(ctx, PADDING, statY, statWidth, data.sessionCount !== undefined ? "Session" : "Climb", data.sessionCount ?? data.climbCount ?? 0);
    drawStatBox(
      ctx,
      PADDING + statWidth + 28,
      statY,
      statWidth,
      data.sessionCount !== undefined ? "Climb" : "最高难度",
      data.sessionCount !== undefined ? data.climbCount ?? 0 : formatValue(data.highestGrade, "待积累")
    );
    drawStatBox(ctx, PADDING + (statWidth + 28) * 2, statY, statWidth, "总尝试", data.totalAttempts ?? 0);

    offsetY = statY + 230;
    ctx.setFillStyle("#2F2621");
    setFont(ctx, 34, "500");
    offsetY += drawWrappedText(ctx, data.summary ?? "今天的进步，也许更像坚持。", PADDING + 26, offsetY, CONTENT_WIDTH - 52, 52);

    ctx.setFillStyle("#7B695D");
    setFont(ctx, 28, "500");
    ctx.fillText(`${formatValue(data.locationName, "未填写地点")} · ${formatValue(data.discipline, "未填写类型")}`, PADDING, CARD_HEIGHT - 142);
  }

  ctx.setFillStyle(accent);
  setFont(ctx, 26, "800");
  ctx.fillText("You are getting braver, not just stronger.", PADDING, CARD_HEIGHT - 120);

  await new Promise<void>((resolve) => {
    ctx.draw(false, resolve);
  });
}

export async function exportShareCardImage(card: ShareCard, canvasId: string) {
  await drawShareCardToCanvas(card, canvasId);

  const result = await Taro.canvasToTempFilePath({
    canvasId,
    x: 0,
    y: 0,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    destWidth: CARD_WIDTH,
    destHeight: CARD_HEIGHT,
    fileType: "png"
  });

  return result.tempFilePath;
}

export async function saveShareCardImageToAlbum(filePath: string) {
  await Taro.saveImageToPhotosAlbum({ filePath });
}
