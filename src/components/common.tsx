import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { PropsWithChildren, ReactNode, useEffect } from "react";
import { useI18n } from "@/i18n";
import { MetricResult } from "@/types/domain";

export function PageHeader({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
}) {
  const { t } = useI18n();
  const displayTitle = t(title);
  const displaySubtitle = subtitle ? t(subtitle) : undefined;

  useEffect(() => {
    try {
      Taro.setNavigationBarTitle({ title: displayTitle });
    } catch {
      // The custom header still renders translated text if the runtime cannot update native title.
    }
  }, [displayTitle]);

  return (
    <View className="page-header">
      <View className="page-header-main">
        <View>
          <View className="page-title">{displayTitle}</View>
          {displaySubtitle ? <View className="page-subtitle">{displaySubtitle}</View> : null}
        </View>
      </View>
      {action}
    </View>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View className="card">{children}</View>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  const { t } = useI18n();
  return <View className="section-title">{typeof children === "string" ? t(children) : children}</View>;
}

export function EmptyState({
  title,
  actionText,
  onAction
}: {
  title: string;
  actionText?: string;
  onAction?: () => void;
}) {
  const { t } = useI18n();

  return (
    <View className="card empty-state">
      <View>{t(title)}</View>
      {actionText && onAction ? (
        <Button className="secondary-button" onClick={onAction}>
          {t(actionText)}
        </Button>
      ) : null}
    </View>
  );
}

export function MetricCard({ metric }: { metric: MetricResult }) {
  const { t } = useI18n();

  return (
    <View className="metric-card">
      <View className="metric-name">{t(metric.title)}</View>
      <View className="metric-value">{t(metric.value)}</View>
      <View className="metric-note">{t(metric.detail)}</View>
    </View>
  );
}

export function PillRow({ items }: { items: string[] }) {
  return (
    <View className="pill-row">
      {items.map((item) => (
        <Text key={item} className="pill">
          {item}
        </Text>
      ))}
    </View>
  );
}
