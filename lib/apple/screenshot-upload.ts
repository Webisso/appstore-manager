import { createHash } from "crypto";
import { appleFetch } from "./client";
import { isIphoneScreenshotDisplayType } from "./screenshot-dimensions";
import { resizeIphoneScreenshot } from "@/lib/image/resize-iphone-screenshot";
import type {
  AppScreenshotAttributes,
  AppScreenshotSetAttributes,
  AppleCredentials,
  JsonApiResource,
  JsonApiResponse,
} from "./types";

interface UploadOperation {
  method?: string;
  url: string;
  length: number;
  offset: number;
  requestHeaders?: Array<{ name: string; value: string }>;
}

interface AppScreenshotReservationAttributes extends AppScreenshotAttributes {
  uploadOperations?: UploadOperation[];
}

function toResources<T>(
  data: JsonApiResource<T> | JsonApiResource<T>[] | undefined
): JsonApiResource<T>[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function getAttributes<T>(
  resource: JsonApiResource<T> | undefined
): T | undefined {
  return resource?.attributes;
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

async function listScreenshotSets(
  credentials: AppleCredentials,
  versionLocalizationId: string
): Promise<JsonApiResource<AppScreenshotSetAttributes>[]> {
  const response = await appleFetch<
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

  return toResources(response.data);
}

export async function findOrCreateScreenshotSet(
  credentials: AppleCredentials,
  versionLocalizationId: string,
  displayType: string
): Promise<string> {
  const sets = await listScreenshotSets(credentials, versionLocalizationId);
  const existing = sets.find(
    (set) =>
      getAttributes(set)?.screenshotDisplayType === displayType
  );

  if (existing) return existing.id;

  const response = await appleFetch<
    JsonApiResponse<AppScreenshotSetAttributes>
  >(credentials, "/appScreenshotSets", {
    method: "POST",
    body: {
      data: {
        type: "appScreenshotSets",
        attributes: {
          screenshotDisplayType: displayType,
        },
        relationships: {
          appStoreVersionLocalization: {
            data: {
              type: "appStoreVersionLocalizations",
              id: versionLocalizationId,
            },
          },
        },
      },
    },
  });

  const created = Array.isArray(response.data)
    ? response.data[0]
    : response.data;

  if (!created?.id) {
    throw new Error("Failed to create screenshot set.");
  }

  return created.id;
}

async function uploadChunks(
  buffer: Buffer,
  operations: UploadOperation[],
  fallbackMimeType: string
): Promise<void> {
  for (const operation of operations) {
    const chunk = buffer.subarray(
      operation.offset,
      operation.offset + operation.length
    );

    const headers: Record<string, string> = {};
    for (const header of operation.requestHeaders ?? []) {
      headers[header.name] = header.value;
    }
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = fallbackMimeType;
    }

    const response = await fetch(operation.url, {
      method: operation.method ?? "PUT",
      headers,
      body: new Uint8Array(chunk),
    });

    if (!response.ok) {
      throw new Error(
        `Screenshot upload chunk failed (${response.status} ${response.statusText}).`
      );
    }
  }
}

export async function uploadScreenshotToSet(
  credentials: AppleCredentials,
  setId: string,
  fileName: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const reservation = await appleFetch<
    JsonApiResponse<AppScreenshotReservationAttributes>
  >(credentials, "/appScreenshots", {
    method: "POST",
    body: {
      data: {
        type: "appScreenshots",
        attributes: {
          fileName,
          fileSize: imageBuffer.length,
        },
        relationships: {
          appScreenshotSet: {
            data: {
              type: "appScreenshotSets",
              id: setId,
            },
          },
        },
      },
    },
  });

  const screenshot = Array.isArray(reservation.data)
    ? reservation.data[0]
    : reservation.data;

  if (!screenshot?.id) {
    throw new Error("Failed to reserve screenshot upload.");
  }

  const operations = getAttributes(screenshot)?.uploadOperations ?? [];
  if (operations.length === 0) {
    throw new Error("Apple did not return upload operations.");
  }

  await uploadChunks(imageBuffer, operations, mimeType);

  const checksum = createHash("md5").update(imageBuffer).digest("hex");

  await appleFetch(credentials, `/appScreenshots/${screenshot.id}`, {
    method: "PATCH",
    body: {
      data: {
        type: "appScreenshots",
        id: screenshot.id,
        attributes: {
          uploaded: true,
          sourceFileChecksum: checksum,
        },
      },
    },
  });

  return screenshot.id;
}

export interface ScreenshotUploadPayload {
  displayType: string;
  fileName: string;
  imageBase64: string;
  mimeType: string;
}

export async function uploadLocalizationScreenshot(
  credentials: AppleCredentials,
  versionLocalizationId: string,
  payload: ScreenshotUploadPayload
): Promise<{ screenshotId: string; setId: string }> {
  const setId = await findOrCreateScreenshotSet(
    credentials,
    versionLocalizationId,
    payload.displayType
  );

  let buffer = Buffer.from(payload.imageBase64, "base64");
  let mimeType = payload.mimeType;

  if (isIphoneScreenshotDisplayType(payload.displayType)) {
    const resized = await resizeIphoneScreenshot(buffer);
    buffer = Buffer.from(resized.imageBase64, "base64");
    mimeType = resized.mimeType;
  }

  const ext = extensionForMimeType(mimeType);
  const fileName = payload.fileName.includes(".")
    ? payload.fileName.replace(/\.[^.]+$/, `.${ext}`)
    : `${payload.fileName}.${ext}`;

  const screenshotId = await uploadScreenshotToSet(
    credentials,
    setId,
    fileName,
    buffer,
    mimeType
  );

  return { screenshotId, setId };
}
