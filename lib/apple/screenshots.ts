import { appleFetch } from "./client";
import type {
  AppScreenshotAttributes,
  AppScreenshotDetail,
  AppScreenshotSetAttributes,
  AppScreenshotSetDetail,
  AppleCredentials,
  ImageAsset,
  JsonApiResource,
  JsonApiResponse,
  LocalizationScreenshots,
  ScreenshotDeviceCategory,
} from "./types";

function getResourceAttributes<T>(
  resource: JsonApiResource<T> | undefined
): T | undefined {
  return resource?.attributes;
}

function toResources<T>(
  data: JsonApiResource<T> | JsonApiResource<T>[] | undefined
): JsonApiResource<T>[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

const DISPLAY_TYPE_LABELS: Record<string, string> = {
  APP_IPHONE_67: 'iPhone 6.7"',
  APP_IPHONE_65: 'iPhone 6.5"',
  APP_IPHONE_58: 'iPhone 5.8"',
  APP_IPHONE_55: 'iPhone 5.5"',
  APP_IPHONE_47: 'iPhone 4.7"',
  APP_IPHONE_40: 'iPhone 4"',
  APP_IPHONE_35: 'iPhone 3.5"',
  APP_IPAD_PRO_3GEN_129: 'iPad Pro 12.9"',
  APP_IPAD_PRO_3GEN_11: 'iPad Pro 11"',
  APP_IPAD_105: 'iPad 10.5"',
  APP_IPAD_97: 'iPad 9.7"',
};

export function resolveImageAssetUrl(
  imageAsset: ImageAsset,
  format = "png"
): string | undefined {
  const { templateUrl, width, height } = imageAsset;
  if (!templateUrl || !width || !height) return undefined;

  return templateUrl
    .replace("{w}", String(width))
    .replace("{h}", String(height))
    .replace("{f}", format);
}

export function getScreenshotDisplayLabel(displayType: string): string {
  return DISPLAY_TYPE_LABELS[displayType] ?? displayType.replace(/^APP_/, "").replace(/_/g, " ");
}

export function getScreenshotDeviceCategory(
  displayType: string
): ScreenshotDeviceCategory {
  if (displayType.includes("IPAD")) return "ipad";
  if (displayType.includes("IPHONE")) return "iphone";
  return "other";
}

function mapScreenshot(
  resource: JsonApiResource<AppScreenshotAttributes>
): AppScreenshotDetail {
  const attrs = getResourceAttributes(resource) ?? {};
  const imageAsset = attrs.imageAsset;

  return {
    id: resource.id,
    fileName: attrs.fileName,
    imageUrl: imageAsset ? resolveImageAssetUrl(imageAsset) : undefined,
    width: imageAsset?.width,
    height: imageAsset?.height,
    assetDeliveryState: attrs.assetDeliveryState,
  };
}

async function fetchScreenshotSet(
  credentials: AppleCredentials,
  set: JsonApiResource<AppScreenshotSetAttributes>
): Promise<AppScreenshotSetDetail> {
  const attrs = getResourceAttributes(set) ?? {};
  const displayType = attrs.screenshotDisplayType ?? "UNKNOWN";

  const screenshotsResponse = await appleFetch<
    JsonApiResponse<AppScreenshotAttributes>
  >(credentials, `/appScreenshotSets/${set.id}/appScreenshots`, {
    searchParams: {
      limit: 200,
      "fields[appScreenshots]":
        "fileName,imageAsset,assetDeliveryState",
    },
  });

  const screenshots = toResources(screenshotsResponse.data)
    .map(mapScreenshot)
    .filter((shot) => Boolean(shot.imageUrl));

  return {
    id: set.id,
    displayType,
    displayLabel: getScreenshotDisplayLabel(displayType),
    deviceCategory: getScreenshotDeviceCategory(displayType),
    screenshots,
  };
}

export async function fetchLocalizationScreenshots(
  credentials: AppleCredentials,
  versionLocalizationId: string
): Promise<LocalizationScreenshots> {
  const setsResponse = await appleFetch<
    JsonApiResponse<AppScreenshotSetAttributes>
  >(
    credentials,
    `/appStoreVersionLocalizations/${versionLocalizationId}/appScreenshotSets`,
    {
      searchParams: {
        limit: 200,
        "fields[appScreenshotSets]": "screenshotDisplayType",
      },
    }
  );

  const sets = toResources(setsResponse.data);
  const detailedSets = await Promise.all(
    sets.map((set) => fetchScreenshotSet(credentials, set))
  );

  const sortedSets = detailedSets.sort((a, b) => {
    const categoryOrder = (category: ScreenshotDeviceCategory) => {
      if (category === "iphone") return 0;
      if (category === "ipad") return 1;
      return 2;
    };

    const categoryDiff =
      categoryOrder(a.deviceCategory) - categoryOrder(b.deviceCategory);
    if (categoryDiff !== 0) return categoryDiff;

    return a.displayLabel.localeCompare(b.displayLabel);
  });

  return {
    versionLocalizationId,
    sets: sortedSets,
  };
}
