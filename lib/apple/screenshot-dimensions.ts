/** App Store Connect iPhone 6.5" / 6.7" upload size. */
export const IPHONE_UPLOAD_WIDTH = 1242;
export const IPHONE_UPLOAD_HEIGHT = 2688;

export const IPHONE_UPLOAD_DIMENSIONS_LABEL = `${IPHONE_UPLOAD_WIDTH}×${IPHONE_UPLOAD_HEIGHT}`;

export function isIphoneScreenshotDisplayType(displayType: string): boolean {
  return displayType.includes("IPHONE");
}

export function getIphonePreviewAspectRatio(): string {
  return `${IPHONE_UPLOAD_WIDTH} / ${IPHONE_UPLOAD_HEIGHT}`;
}
