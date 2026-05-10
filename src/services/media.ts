import Taro from "@tarojs/taro";

export type DraftMediaAsset = {
  uri: string;
  type: "image" | "video";
  thumbnailUri?: string;
};

export async function chooseDraftMedia(existingCount: number) {
  const remainingCount = Math.max(1, 9 - existingCount);
  const result = await Taro.chooseMedia({
    count: remainingCount,
    mediaType: ["image", "video"],
    sourceType: ["album", "camera"],
    sizeType: ["compressed"]
  });

  return result.tempFiles.map((item) => ({
    uri: item.tempFilePath,
    type: item.fileType === "video" ? "video" : "image",
    thumbnailUri: item.thumbTempFilePath
  })) satisfies DraftMediaAsset[];
}

export async function persistMediaUri(uri: string) {
  try {
    const saved = await Taro.saveFile({ tempFilePath: uri });
    if ("savedFilePath" in saved && typeof saved.savedFilePath === "string") {
      return saved.savedFilePath;
    }

    return uri;
  } catch {
    return uri;
  }
}
