import { Button, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/common";
import { useBootstrapData } from "@/hooks/use-bootstrap-data";
import { useI18n } from "@/i18n";
import { useProtectedPage } from "@/hooks/use-protected-page";
import { AppLanguage, LANGUAGE_OPTIONS } from "@/services/preferences";

export default function MePage() {
  const auth = useProtectedPage();
  const { media, isLoading } = useBootstrapData(auth.isAuthenticated && !auth.isLoading);
  const { language, setLanguage, t } = useI18n();

  function handleLogout() {
    auth.logout();
    Taro.reLaunch({ url: "/pages/login/index" });
  }

  function handleLanguageChange(nextLanguage: AppLanguage) {
    setLanguage(nextLanguage);
    Taro.showToast({ title: nextLanguage === "en" ? "Language updated" : "语言偏好已保存", icon: "none" });
  }

  return (
    <View className="page">
      <PageHeader
        title={t("我的")}
        subtitle={`${auth.user?.nickname ?? "你"} · ${auth.user?.email ?? ""}`}
        showBack
        action={
          <Button className="ghost-button" onClick={handleLogout}>
            {t("退出登录")}
          </Button>
        }
      />

      <SectionTitle>{t("攀岩相册")}</SectionTitle>
      <Card>
        <View className="row-between">
          <View>
            <View className="card-title">{t("攀岩相册")}</View>
            <View className="card-subtitle">{isLoading ? t("正在加载媒体…") : `${media.length} ${t("个媒体资源")}`}</View>
          </View>
          <Button className="secondary-button" onClick={() => Taro.navigateTo({ url: "/pages/media-gallery/index" })}>
            {t("打开相册")}
          </Button>
        </View>
      </Card>

      <SectionTitle>{t("设置与导出")}</SectionTitle>
      <Card>
        <View className="stack-sm">
          <View>
            <View className="field-label">{t("语言")}</View>
            <View className="choice-group">
              {LANGUAGE_OPTIONS.map((option) => (
                <View
                  key={option.value}
                  className={`choice-chip ${language === option.value ? "active" : ""}`}
                  onClick={() => handleLanguageChange(option.value)}
                >
                  {t(option.label)}
                </View>
              ))}
            </View>
          </View>
          <View>{t("设置：难度系统、隐私、数据存储说明")}</View>
          <View>{t("数据导出：当前业务数据以服务端文件数据库持久化")}</View>
          <View>{t("隐私说明：你的记录默认只属于你自己。")}</View>
        </View>
      </Card>
      {!media.length ? <EmptyState title={isLoading ? t("正在加载媒体…") : t("还没有媒体。请先在 Climb 里选图，然后保存整个 Session。")} /> : null}
    </View>
  );
}
