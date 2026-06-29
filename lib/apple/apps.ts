import { appleFetch } from "./client";
import type {
  AppAttributes,
  AppDetail,
  AppStoreVersionAttributes,
  AppStoreVersionLocalizationAttributes,
  AppSummary,
  AppleCredentials,
  AppInfoLocalizationAttributes,
  BuildAttributes,
  BuildIconAttributes,
  JsonApiResource,
  JsonApiResponse,
  LocalizationDetail,
} from "./types";

function getResourceAttributes<T>(
  resource: JsonApiResource<T> | undefined
): T | undefined {
  return resource?.attributes;
}

function findIncluded<T>(
  included: JsonApiResource[] | undefined,
  type: string,
  id: string
): JsonApiResource<T> | undefined {
  return included?.find((item) => item.type === type && item.id === id) as
    | JsonApiResource<T>
    | undefined;
}

/** Converts Apple's iconAssetToken templateUrl to a usable image URL. */
export function resolveIconUrl(
  templateUrl: string,
  size = 120
): string {
  return templateUrl
    .replace("{w}", String(size))
    .replace("{h}", String(size))
    .replace("{f}", "png");
}

function iconFromToken(token?: { templateUrl?: string }): string | undefined {
  if (!token?.templateUrl) return undefined;
  return resolveIconUrl(token.templateUrl);
}

const ICON_TYPE_PRIORITY = [
  "APP_STORE",
  "IOS_APP_STORE",
  "MAC_APP_STORE",
  "TV_OS_APP_STORE",
  "WATCH_APP_STORE",
  "IOS_APP_ICON",
  "APP_ICON",
];

function pickBestBuildIcon(
  icons: JsonApiResource<BuildIconAttributes>[]
): string | undefined {
  const sorted = [...icons].sort((a, b) => {
    const aType = getResourceAttributes(a)?.iconAssetType ?? "";
    const bType = getResourceAttributes(b)?.iconAssetType ?? "";
    const aIdx = ICON_TYPE_PRIORITY.indexOf(aType);
    const bIdx = ICON_TYPE_PRIORITY.indexOf(bType);
    const aScore = aIdx === -1 ? 999 : aIdx;
    const bScore = bIdx === -1 ? 999 : bIdx;
    return aScore - bScore;
  });

  for (const icon of sorted) {
    const url = iconFromToken(getResourceAttributes(icon)?.iconAssetToken);
    if (url) return url;
  }

  return undefined;
}

function pickLatestBuild(
  builds: JsonApiResource<BuildAttributes>[]
): JsonApiResource<BuildAttributes> | undefined {
  if (builds.length === 0) return undefined;
  if (builds.length === 1) return builds[0];

  return [...builds].sort((a, b) => {
    const aDate = getResourceAttributes(a)?.uploadedDate;
    const bDate = getResourceAttributes(b)?.uploadedDate;
    if (aDate && bDate) {
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    }
    return 0;
  })[0];
}

function iconsForBuild(
  build: JsonApiResource<BuildAttributes>,
  included?: JsonApiResource[]
): JsonApiResource<BuildIconAttributes>[] {
  const refs = build.relationships?.buildIcons?.data;
  if (!refs || !included) return [];

  const ids = Array.isArray(refs) ? refs : [refs];
  const result: JsonApiResource<BuildIconAttributes>[] = [];

  for (const ref of ids) {
    const item = included.find(
      (entry) => entry.type === ref.type && entry.id === ref.id
    );
    if (item?.type === "buildIcons") {
      result.push(item as JsonApiResource<BuildIconAttributes>);
    }
  }

  return result;
}

async function fetchItunesIcon(
  bundleId: string,
  appId: string
): Promise<string | undefined> {
  const lookups: Array<[string, string]> = [];
  if (bundleId && bundleId !== "—") lookups.push(["bundleId", bundleId]);
  if (appId) lookups.push(["id", appId]);

  for (const [key, value] of lookups) {
    try {
      const url = new URL("https://itunes.apple.com/lookup");
      url.searchParams.set(key, value);
      url.searchParams.set("entity", "software");

      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) continue;

      const data = (await response.json()) as {
        results?: Array<{ artworkUrl512?: string; artworkUrl100?: string }>;
      };

      const result = data.results?.[0];
      const icon = result?.artworkUrl512 ?? result?.artworkUrl100;
      if (icon) return icon;
    } catch {
      continue;
    }
  }

  return undefined;
}

async function fetchIconFromBuildId(
  credentials: AppleCredentials,
  buildId: string
): Promise<string | undefined> {
  try {
    const buildResponse = await appleFetch<JsonApiResponse<BuildAttributes>>(
      credentials,
      `/builds/${buildId}`,
      { searchParams: { "fields[builds]": "iconAssetToken" } }
    );

    const build = Array.isArray(buildResponse.data)
      ? buildResponse.data[0]
      : buildResponse.data;

    const direct = iconFromToken(getResourceAttributes(build)?.iconAssetToken);
    if (direct) return direct;
  } catch {
    // try buildIcons endpoint
  }

  try {
    const iconsResponse = await appleFetch<JsonApiResponse<BuildIconAttributes>>(
      credentials,
      `/builds/${buildId}/buildIcons`,
      { searchParams: { limit: 20 } }
    );

    const icons = Array.isArray(iconsResponse.data)
      ? iconsResponse.data
      : iconsResponse.data
        ? [iconsResponse.data]
        : [];

    return pickBestBuildIcon(icons);
  } catch {
    return undefined;
  }
}

async function fetchBuildIdFromAppStoreVersion(
  credentials: AppleCredentials,
  appId: string
): Promise<string | undefined> {
  try {
    const versionsResponse = await appleFetch<
      JsonApiResponse<AppStoreVersionAttributes>
    >(credentials, `/apps/${appId}/appStoreVersions`, {
      searchParams: {
        limit: 20,
        "fields[appStoreVersions]": "platform,createdDate",
      },
    });

    const versions = Array.isArray(versionsResponse.data)
      ? versionsResponse.data
      : versionsResponse.data
        ? [versionsResponse.data]
        : [];

    const latest = pickLatestVersion(versions);
    if (!latest?.id) return undefined;

    const buildResponse = await appleFetch<JsonApiResponse<BuildAttributes>>(
      credentials,
      `/appStoreVersions/${latest.id}/build`,
      { searchParams: { "fields[builds]": "uploadedDate" } }
    );

    const build = Array.isArray(buildResponse.data)
      ? buildResponse.data[0]
      : buildResponse.data;

    return build?.id;
  } catch {
    return undefined;
  }
}

async function fetchIconFromAppBuilds(
  credentials: AppleCredentials,
  appId: string
): Promise<string | undefined> {
  try {
    const response = await appleFetch<JsonApiResponse<BuildAttributes>>(
      credentials,
      `/apps/${appId}/builds`,
      {
        searchParams: {
          limit: 25,
          include: "buildIcons",
          "fields[builds]": "iconAssetToken,uploadedDate",
          "fields[buildIcons]": "iconAssetType,iconAssetToken",
        },
      }
    );

    const builds = Array.isArray(response.data)
      ? response.data
      : response.data
        ? [response.data]
        : [];

    if (builds.length === 0) return undefined;

    const sorted = [...builds].sort((a, b) => {
      const aDate = getResourceAttributes(a)?.uploadedDate;
      const bDate = getResourceAttributes(b)?.uploadedDate;
      if (aDate && bDate) {
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      }
      return 0;
    });

    for (const build of sorted) {
      const fromToken = iconFromToken(
        getResourceAttributes(build)?.iconAssetToken
      );
      if (fromToken) return fromToken;

      const includedIcons = iconsForBuild(build, response.included);
      const fromIncluded = pickBestBuildIcon(includedIcons);
      if (fromIncluded) return fromIncluded;
    }

    const latest = pickLatestBuild(builds);
    if (latest?.id) {
      return fetchIconFromBuildId(credentials, latest.id);
    }
  } catch {
    // fall through
  }

  return undefined;
}

async function fetchAppIconUrl(
  credentials: AppleCredentials,
  appId: string,
  bundleId: string
): Promise<string | undefined> {
  // 1. Builds + buildIcons (works for TestFlight / review builds)
  const fromBuilds = await fetchIconFromAppBuilds(credentials, appId);
  if (fromBuilds) return fromBuilds;

  // 2. Build attached to current App Store version (first submission)
  const versionBuildId = await fetchBuildIdFromAppStoreVersion(
    credentials,
    appId
  );
  if (versionBuildId) {
    const fromVersionBuild = await fetchIconFromBuildId(
      credentials,
      versionBuildId
    );
    if (fromVersionBuild) return fromVersionBuild;
  }

  // 3. Public App Store artwork (published apps only)
  return fetchItunesIcon(bundleId, appId);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

export async function testAppleConnection(
  credentials: AppleCredentials
): Promise<{ success: true; appCount: number }> {
  const response = await appleFetch<JsonApiResponse<AppAttributes>>(
    credentials,
    "/apps",
    { searchParams: { limit: 1 } }
  );

  const data = Array.isArray(response.data) ? response.data : [response.data];
  const meta = response.meta as { paging?: { total?: number } } | undefined;

  return {
    success: true,
    appCount: meta?.paging?.total ?? data.length,
  };
}

export async function fetchApps(
  credentials: AppleCredentials
): Promise<AppSummary[]> {
  const response = await appleFetch<JsonApiResponse<AppAttributes>>(
    credentials,
    "/apps",
    {
      searchParams: {
        limit: 200,
        "fields[apps]": "name,bundleId,primaryLocale",
      },
    }
  );

  const apps = Array.isArray(response.data) ? response.data : [response.data];

  const summaries: AppSummary[] = apps.map((app) => {
    const attrs = getResourceAttributes(app) ?? {};
    return {
      id: app.id,
      name: attrs.name ?? "Untitled App",
      bundleId: attrs.bundleId ?? "—",
      primaryLocale: attrs.primaryLocale,
    };
  });

  const iconUrls = await mapWithConcurrency(summaries, 8, (app) =>
    fetchAppIconUrl(credentials, app.id, app.bundleId)
  );

  return summaries.map((app, i) => ({
    ...app,
    iconUrl: iconUrls[i],
  }));
}

function pickLatestVersion(
  versions: JsonApiResource<AppStoreVersionAttributes>[],
  platform = "IOS"
): JsonApiResource<AppStoreVersionAttributes> | undefined {
  if (versions.length === 0) return undefined;

  const platformVersions = versions.filter(
    (v) => getResourceAttributes(v)?.platform === platform
  );
  const pool = platformVersions.length > 0 ? platformVersions : versions;

  if (pool.length === 1) return pool[0];

  return [...pool].sort((a, b) => {
    const aAttrs = getResourceAttributes(a);
    const bAttrs = getResourceAttributes(b);

    if (aAttrs?.createdDate && bAttrs?.createdDate) {
      return (
        new Date(bAttrs.createdDate).getTime() -
        new Date(aAttrs.createdDate).getTime()
      );
    }

    const aParts = (aAttrs?.versionString ?? "0").split(".").map(Number);
    const bParts = (bAttrs?.versionString ?? "0").split(".").map(Number);
    const len = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < len; i++) {
      const diff = (bParts[i] ?? 0) - (aParts[i] ?? 0);
      if (diff !== 0) return diff;
    }

    return 0;
  })[0];
}

/** What's New only applies when a previous iOS version was on the App Store. */
function canEditWhatsNew(
  versions: JsonApiResource<AppStoreVersionAttributes>[]
): boolean {
  const publishedStates = new Set([
    "READY_FOR_SALE",
    "REPLACED_WITH_NEW_VERSION",
    "PENDING_DEVELOPER_RELEASE",
    "PROCESSING_FOR_APP_STORE",
    "PENDING_APPLE_RELEASE",
  ]);

  return versions.some((v) => {
    const attrs = getResourceAttributes(v);
    const platform = attrs?.platform;
    if (platform && platform !== "IOS") return false;
    return publishedStates.has(attrs?.appStoreState ?? "");
  });
}

function mapAppInfoLocalizations(
  locData: JsonApiResource<AppInfoLocalizationAttributes>[]
): LocalizationDetail[] {
  return locData.map((loc) => {
    const attrs = getResourceAttributes(loc) ?? {};
    return {
      appInfoLocalizationId: loc.id,
      locale: attrs.locale ?? "unknown",
      name: attrs.name,
      subtitle: attrs.subtitle,
      privacyPolicyUrl: attrs.privacyPolicyUrl,
    };
  });
}

function mapVersionLocalizations(
  locData: JsonApiResource<AppStoreVersionLocalizationAttributes>[]
): LocalizationDetail[] {
  return locData.map((loc) => {
    const attrs = getResourceAttributes(loc) ?? {};
    return {
      versionLocalizationId: loc.id,
      locale: attrs.locale ?? "unknown",
      description: attrs.description,
      keywords: attrs.keywords,
      whatsNew: attrs.whatsNew,
    };
  });
}

/** Apple splits metadata across app-level and version-level localizations. */
function mergeLocalizations(
  appInfoLocs: LocalizationDetail[],
  versionLocs: LocalizationDetail[]
): LocalizationDetail[] {
  const byLocale = new Map<string, LocalizationDetail>();

  for (const loc of appInfoLocs) {
    byLocale.set(loc.locale, { ...loc });
  }

  for (const loc of versionLocs) {
    const existing = byLocale.get(loc.locale);
    byLocale.set(loc.locale, {
      locale: loc.locale,
      appInfoLocalizationId: existing?.appInfoLocalizationId,
      versionLocalizationId: loc.versionLocalizationId,
      name: existing?.name,
      subtitle: existing?.subtitle,
      privacyPolicyUrl: existing?.privacyPolicyUrl,
      description: loc.description,
      keywords: loc.keywords,
      whatsNew: loc.whatsNew,
    });
  }

  return Array.from(byLocale.values()).sort((a, b) =>
    a.locale.localeCompare(b.locale)
  );
}

async function fetchAppInfoLocalizations(
  credentials: AppleCredentials,
  appId: string
): Promise<LocalizationDetail[]> {
  const appInfosResponse = await appleFetch<JsonApiResponse>(
    credentials,
    `/apps/${appId}/appInfos`,
    { searchParams: { limit: 10 } }
  );

  const appInfos = Array.isArray(appInfosResponse.data)
    ? appInfosResponse.data
    : appInfosResponse.data
      ? [appInfosResponse.data]
      : [];

  if (appInfos.length === 0) return [];

  const localizationGroups = await Promise.all(
    appInfos.map(async (appInfo) => {
      const locResponse = await appleFetch<
        JsonApiResponse<AppInfoLocalizationAttributes>
      >(
        credentials,
        `/appInfos/${appInfo.id}/appInfoLocalizations`,
        { searchParams: { limit: 200 } }
      );

      const locData = Array.isArray(locResponse.data)
        ? locResponse.data
        : locResponse.data
          ? [locResponse.data]
          : [];

      return mapAppInfoLocalizations(locData);
    })
  );

  const seen = new Set<string>();
  const merged: LocalizationDetail[] = [];

  for (const group of localizationGroups) {
    for (const loc of group) {
      if (!seen.has(loc.locale)) {
        seen.add(loc.locale);
        merged.push(loc);
      }
    }
  }

  return merged;
}

export async function fetchAppDetail(
  credentials: AppleCredentials,
  appId: string
): Promise<AppDetail> {
  const [appResponse, versionsResponse] = await Promise.all([
    appleFetch<JsonApiResponse<AppAttributes>>(credentials, `/apps/${appId}`),
    appleFetch<JsonApiResponse<AppStoreVersionAttributes>>(
      credentials,
      `/apps/${appId}/appStoreVersions`,
      {
        searchParams: {
          limit: 50,
          "fields[appStoreVersions]": "versionString,appStoreState,platform,createdDate",
        },
      }
    ),
  ]);

  const appData = Array.isArray(appResponse.data)
    ? appResponse.data[0]
    : appResponse.data;
  const appAttrs = getResourceAttributes(appData) ?? {};

  const versions = Array.isArray(versionsResponse.data)
    ? versionsResponse.data
    : versionsResponse.data
      ? [versionsResponse.data]
      : [];

  const latestVersion = pickLatestVersion(versions);
  const versionAttrs = getResourceAttributes(latestVersion);

  const [appInfoLocs, versionLocs] = await Promise.all([
    fetchAppInfoLocalizations(credentials, appId),
    latestVersion?.id
      ? appleFetch<JsonApiResponse<AppStoreVersionLocalizationAttributes>>(
          credentials,
          `/appStoreVersions/${latestVersion.id}/appStoreVersionLocalizations`,
          { searchParams: { limit: 200 } }
        ).then((locResponse) => {
          const locData = Array.isArray(locResponse.data)
            ? locResponse.data
            : locResponse.data
              ? [locResponse.data]
              : [];
          return mapVersionLocalizations(locData);
        })
      : Promise.resolve([]),
  ]);

  const localizations = mergeLocalizations(appInfoLocs, versionLocs);

  return {
    id: appData?.id ?? appId,
    name: appAttrs.name ?? "Untitled App",
    bundleId: appAttrs.bundleId ?? "—",
    primaryLocale: appAttrs.primaryLocale,
    sku: appAttrs.sku,
    version: latestVersion
      ? {
          id: latestVersion.id,
          versionString: versionAttrs?.versionString ?? "—",
          appStoreState: versionAttrs?.appStoreState,
          canEditWhatsNew: canEditWhatsNew(versions),
        }
      : undefined,
    localizations,
  };
}

export { findIncluded, getResourceAttributes };
