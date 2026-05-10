import { Button, Canvas, Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";
import { exportShareCardImage, saveShareCardImageToAlbum, SHARE_CARD_CANVAS_ID } from "@/services/share-card-export";
import { MetricResult, ShareCard } from "@/types/domain";
import { buildShareCardText } from "@/utils/share-card-text";

function formatValue(value: unknown, fallback = "未记录") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="share-card-stat">
      <View className="share-card-stat-label">{label}</View>
      <View className="share-card-stat-value">{value}</View>
    </View>
  );
}

export function ShareCardPreview({ card }: { card: ShareCard }) {
  if (card.type === "project_send") {
    const data = card.data as {
      gradeLabel?: string;
      totalAttempts?: number;
      totalSessions?: number;
      sentDate?: string;
      fearDelta?: string;
    };

    return (
      <View className="share-card-art share-card-art-project">
        <View className="share-card-brand">GRIT JOURNAL</View>
        <View className="share-card-kicker">PROJECT SEND</View>
        <View className="share-card-display-title">{card.title}</View>
        <View className="share-card-script">Sent with grit</View>
        <View className="share-card-stats">
          <StatTile label="难度" value={formatValue(data.gradeLabel)} />
          <StatTile label="累计尝试" value={data.totalAttempts ?? 0} />
          <StatTile label="Session" value={data.totalSessions ?? 0} />
        </View>
        <View className="share-card-quote">{card.subtitle}</View>
        <View className="share-card-footer">
          {formatValue(data.sentDate)} · 恐惧变化 {formatValue(data.fearDelta, "数据不足")}
        </View>
      </View>
    );
  }

  if (card.type === "weekly_growth") {
    const data = card.data as {
      weeklySessionCount?: number;
      weeklyClimbCount?: number;
      activeProjectCount?: number;
      summary?: string;
      metrics?: MetricResult[];
    };

    return (
      <View className="share-card-art share-card-art-weekly">
        <View className="share-card-brand">CLIMBING GRIT</View>
        <View className="share-card-kicker">WEEKLY GROWTH</View>
        <View className="share-card-display-title">{card.title}</View>
        <View className="share-card-stats">
          <StatTile label="Session" value={data.weeklySessionCount ?? 0} />
          <StatTile label="Climb" value={data.weeklyClimbCount ?? 0} />
          <StatTile label="Active Project" value={data.activeProjectCount ?? 0} />
        </View>
        <View className="share-card-quote">{data.summary}</View>
        <View className="share-card-metric-list">
          {(data.metrics ?? []).slice(0, 3).map((metric) => (
            <View key={metric.title} className="share-card-mini-row">
              <View>{metric.title}</View>
              <View>{metric.value}</View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const data = card.data as {
    locationName?: string;
    discipline?: string;
    climbCount?: number;
    sessionCount?: number;
    highestGrade?: string;
    totalAttempts?: number;
    summary?: string;
  };

  return (
    <View className="share-card-art share-card-art-session">
      <View className="share-card-brand">CLIMBING LOG</View>
      <View className="share-card-kicker">SESSION RECAP</View>
      <View className="share-card-display-title">{card.title}</View>
      <View className="share-card-stats">
        <StatTile label={data.sessionCount !== undefined ? "Session" : "Climb"} value={data.sessionCount ?? data.climbCount ?? 0} />
        <StatTile label={data.sessionCount !== undefined ? "Climb" : "最高难度"} value={data.sessionCount !== undefined ? data.climbCount ?? 0 : formatValue(data.highestGrade, "待积累")} />
        <StatTile label="总尝试" value={data.totalAttempts ?? 0} />
      </View>
      <View className="share-card-quote">{data.summary}</View>
      <View className="share-card-footer">
        {formatValue(data.locationName, "未填写地点")} · {formatValue(data.discipline, "未填写类型")}
      </View>
    </View>
  );
}

export function ShareCardModal({
  visible,
  card,
  onClose,
  title = "生成分享卡"
}: {
  visible: boolean;
  card?: ShareCard;
  onClose: () => void;
  title?: string;
}) {
  const [imagePath, setImagePath] = useState<string | undefined>();

  useEffect(() => {
    setImagePath(undefined);
  }, [card?.id]);

  if (!visible || !card) {
    return null;
  }

  async function ensureImage() {
    if (!card) {
      throw new Error("缺少分享卡数据");
    }

    if (imagePath) {
      return imagePath;
    }

    Taro.showLoading({ title: "正在生成图片" });

    try {
      const nextPath = await exportShareCardImage(card, SHARE_CARD_CANVAS_ID);
      setImagePath(nextPath);
      return nextPath;
    } finally {
      Taro.hideLoading();
    }
  }

  async function handlePreview() {
    try {
      const nextPath = await ensureImage();
      await Taro.previewImage({ urls: [nextPath], current: nextPath });
    } catch {
      Taro.showToast({ title: "预览图片失败", icon: "none" });
    }
  }

  async function handleSave() {
    try {
      const nextPath = await ensureImage();
      await saveShareCardImageToAlbum(nextPath);
      Taro.showToast({ title: "已保存到相册", icon: "success" });
    } catch (error) {
      if (error && typeof error === "object" && "errMsg" in error && String(error.errMsg).includes("auth deny")) {
        Taro.showToast({ title: "请允许保存到相册", icon: "none" });
        return;
      }

      Taro.showToast({ title: "保存图片失败", icon: "none" });
    }
  }

  async function handleShare() {
    try {
      const nextPath = await ensureImage();
      await Taro.showShareImageMenu({ path: nextPath });
    } catch {
      Taro.showToast({ title: "请先保存图片后转发", icon: "none" });
    }
  }

  return (
    <View className="modal-backdrop" onClick={onClose}>
      <View className="share-modal" onClick={(event) => event.stopPropagation()}>
        <View className="row-between">
          <View>
            <View className="card-title">{title}</View>
            <View className="card-subtitle">可直接预览、微信分享，或保存到本地相册。</View>
          </View>
          <Button className="ghost-button" onClick={onClose}>
            关闭
          </Button>
        </View>

        <View className="share-card-preview-wrap">
          <ShareCardPreview card={card} />
        </View>

        {imagePath ? <Image className="share-card-image-preview" src={imagePath} mode="aspectFit" /> : null}

        <View className="row share-card-actions">
          <Button className="primary-button" onClick={handleShare}>
            微信分享
          </Button>
          <Button className="secondary-button" onClick={handlePreview}>
            预览图片
          </Button>
        </View>
        <View className="row share-card-actions">
          <Button className="ghost-button" onClick={handleSave}>
            保存本地
          </Button>
          <Button className="ghost-button" onClick={() => Taro.setClipboardData({ data: buildShareCardText(card) })}>
            复制文案
          </Button>
        </View>

        <Canvas canvasId={SHARE_CARD_CANVAS_ID} className="export-canvas" style={{ width: "1080px", height: "1440px" }} />
      </View>
    </View>
  );
}
