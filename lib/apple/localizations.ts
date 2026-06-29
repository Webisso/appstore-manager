import { appleFetch } from "./client";
import type {
  AppInfoLocalizationAttributes,
  AppleCredentials,
  AppStoreVersionLocalizationAttributes,
  JsonApiResponse,
  LocalizationDetail,
  LocalizationSavePayload,
} from "./types";

function buildPatchBody<T extends string>(
  type: T,
  id: string,
  attributes: Record<string, string | undefined>
) {
  const cleaned = Object.fromEntries(
    Object.entries(attributes).filter(([, v]) => v !== undefined)
  );

  return {
    data: {
      type,
      id,
      attributes: cleaned,
    },
  };
}

export async function updateAppInfoLocalization(
  credentials: AppleCredentials,
  id: string,
  attributes: Pick<
    AppInfoLocalizationAttributes,
    "name" | "subtitle" | "privacyPolicyUrl"
  >
): Promise<void> {
  await appleFetch(
    credentials,
    `/appInfoLocalizations/${id}`,
    {
      method: "PATCH",
      body: buildPatchBody("appInfoLocalizations", id, attributes),
    }
  );
}

export async function updateVersionLocalization(
  credentials: AppleCredentials,
  id: string,
  attributes: Partial<
    Pick<AppStoreVersionLocalizationAttributes, "description" | "keywords" | "whatsNew">
  >
): Promise<void> {
  await appleFetch(
    credentials,
    `/appStoreVersionLocalizations/${id}`,
    {
      method: "PATCH",
      body: buildPatchBody("appStoreVersionLocalizations", id, attributes),
    }
  );
}

export async function createVersionLocalization(
  credentials: AppleCredentials,
  versionId: string,
  locale: string,
  attributes: Partial<
    Pick<AppStoreVersionLocalizationAttributes, "description" | "keywords" | "whatsNew">
  >
): Promise<string> {
  const response = await appleFetch<
    JsonApiResponse<AppStoreVersionLocalizationAttributes>
  >(credentials, "/appStoreVersionLocalizations", {
    method: "POST",
    body: {
      data: {
        type: "appStoreVersionLocalizations",
        attributes: {
          locale,
          ...Object.fromEntries(
            Object.entries(attributes).filter(([, v]) => v !== undefined && v !== "")
          ),
        },
        relationships: {
          appStoreVersion: {
            data: { type: "appStoreVersions", id: versionId },
          },
        },
      },
    },
  });

  const resource = Array.isArray(response.data)
    ? response.data[0]
    : response.data;

  if (!resource?.id) {
    throw new Error("Failed to create version localization.");
  }

  return resource.id;
}

export async function updatePrivacyPolicyOnly(
  credentials: AppleCredentials,
  id: string,
  privacyPolicyUrl: string
): Promise<void> {
  await appleFetch(credentials, `/appInfoLocalizations/${id}`, {
    method: "PATCH",
    body: buildPatchBody("appInfoLocalizations", id, { privacyPolicyUrl }),
  });
}

export async function saveLocalization(
  credentials: AppleCredentials,
  payload: LocalizationSavePayload,
  versionId?: string
): Promise<LocalizationDetail> {
  const {
    locale,
    appInfoLocalizationId,
    versionLocalizationId,
    name,
    subtitle,
    privacyPolicyUrl,
    description,
    keywords,
    whatsNew,
    includeWhatsNew = true,
  } = payload;

  let newVersionLocalizationId = versionLocalizationId;

  if (appInfoLocalizationId) {
    await updateAppInfoLocalization(credentials, appInfoLocalizationId, {
      name: name ?? "",
      subtitle: subtitle ?? "",
      privacyPolicyUrl: privacyPolicyUrl ?? "",
    });
  }

  const versionAttributes: Partial<
    Pick<AppStoreVersionLocalizationAttributes, "description" | "keywords" | "whatsNew">
  > = {
    description: description ?? "",
    keywords: keywords ?? "",
  };

  if (includeWhatsNew) {
    versionAttributes.whatsNew = whatsNew ?? "";
  }

  if (versionLocalizationId) {
    await updateVersionLocalization(
      credentials,
      versionLocalizationId,
      versionAttributes
    );
  } else if (versionId) {
    newVersionLocalizationId = await createVersionLocalization(
      credentials,
      versionId,
      locale,
      versionAttributes
    );
  }

  return {
    locale,
    appInfoLocalizationId,
    versionLocalizationId: newVersionLocalizationId,
    name,
    subtitle,
    privacyPolicyUrl,
    description,
    keywords,
    ...(includeWhatsNew ? { whatsNew } : {}),
  };
}
