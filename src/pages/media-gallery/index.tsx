import { Button, Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Card, EmptyState, PageHeader } from "@/components/common";
import { useBootstrapData } from "@/hooks/use-bootstrap-data";
import { useProtectedPage } from "@/hooks/use-protected-page";

export default function MediaGalleryPage() {
  const auth = useProtectedPage();
  const { media, isLoading } = useBootstrapData(auth.isAuthenticated && !auth.isLoading);

  return (
    <View className="page">
      <PageHeader title="攀岩相册" subtitle={`${media.length} 个媒体资源`} />

      {media.length ? (
        <View className="media-gallery-grid">
          {media.map((item) => (
            <Card key={item.id}>
              <View className="card-title">{item.type === "image" ? "图片" : "视频"}</View>
              <View className="card-subtitle">{item.caption ?? item.uri}</View>
              {item.type === "image" ? (
                <Image className="media-thumb" src={item.thumbnailUri ?? item.uri} mode="aspectFill" />
              ) : (
                <View className="media-video-placeholder">视频文件已保存到服务端记录，当前展示本地路径或持久路径。</View>
              )}
              <Button className="ghost-button" style={{ marginTop: "12px" }} onClick={() => Taro.setClipboardData({ data: item.uri })}>
                复制路径
              </Button>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState title={isLoading ? "正在加载媒体…" : "还没有媒体。请先在 Climb 里选图，然后保存整个 Session。"} />
      )}
    </View>
  );
}
