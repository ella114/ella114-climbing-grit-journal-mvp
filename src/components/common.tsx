import { Button, Text, View } from "@tarojs/components";
import { PropsWithChildren, ReactNode } from "react";
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
  return (
    <View className="page-header">
      <View className="page-header-main">
        <View>
          <View className="page-title">{title}</View>
          {subtitle ? <View className="page-subtitle">{subtitle}</View> : null}
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
  return <View className="section-title">{children}</View>;
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
  return (
    <View className="card empty-state">
      <View>{title}</View>
      {actionText && onAction ? (
        <Button className="secondary-button" onClick={onAction}>
          {actionText}
        </Button>
      ) : null}
    </View>
  );
}

export function MetricCard({ metric }: { metric: MetricResult }) {
  return (
    <View className="metric-card">
      <View className="metric-name">{metric.title}</View>
      <View className="metric-value">{metric.value}</View>
      <View className="metric-note">{metric.detail}</View>
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
