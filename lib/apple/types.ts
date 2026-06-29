export interface AppleCredentials {
  issuerId: string;
  keyId: string;
  privateKey: string;
  label?: string;
}

export interface JsonApiResource<T = Record<string, unknown>> {
  type: string;
  id: string;
  attributes?: T;
  relationships?: Record<
    string,
    {
      data?: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] | null;
    }
  >;
}

export interface JsonApiResourceIdentifier {
  type: string;
  id: string;
}

export interface JsonApiResponse<T = Record<string, unknown>> {
  data: JsonApiResource<T> | JsonApiResource<T>[];
  included?: JsonApiResource[];
  links?: Record<string, string>;
  meta?: Record<string, unknown>;
}

export interface AppAttributes {
  name?: string;
  bundleId?: string;
  primaryLocale?: string;
  sku?: string;
}

export interface AppStoreVersionAttributes {
  versionString?: string;
  appStoreState?: string;
  platform?: string;
  createdDate?: string;
}

export interface AppInfoLocalizationAttributes {
  locale?: string;
  name?: string;
  subtitle?: string;
  privacyPolicyUrl?: string;
  privacyPolicyText?: string;
}

export interface AppStoreVersionLocalizationAttributes {
  locale?: string;
  name?: string;
  subtitle?: string;
  description?: string;
  keywords?: string;
  whatsNew?: string;
  promotionalText?: string;
}

export interface IconAssetToken {
  width?: number;
  height?: number;
  templateUrl?: string;
}

export interface BuildAttributes {
  version?: string;
  uploadedDate?: string;
  processingState?: string;
  iconAssetToken?: IconAssetToken;
}

export interface BuildIconAttributes {
  iconAssetType?: string;
  iconAssetToken?: IconAssetToken;
}

export interface AppSummary {
  id: string;
  name: string;
  bundleId: string;
  primaryLocale?: string;
  iconUrl?: string;
}

export interface AppDetail {
  id: string;
  name: string;
  bundleId: string;
  primaryLocale?: string;
  sku?: string;
  version?: {
    id: string;
    versionString: string;
    appStoreState?: string;
    /** What's New is only for updates — not the initial App Store release. */
    canEditWhatsNew?: boolean;
  };
  localizations: LocalizationDetail[];
}

export interface LocalizationDetail {
  locale: string;
  appInfoLocalizationId?: string;
  versionLocalizationId?: string;
  name?: string;
  subtitle?: string;
  description?: string;
  keywords?: string;
  whatsNew?: string;
  privacyPolicyUrl?: string;
}

export interface LocalizationSavePayload {
  locale: string;
  appInfoLocalizationId?: string;
  versionLocalizationId?: string;
  name?: string;
  subtitle?: string;
  privacyPolicyUrl?: string;
  description?: string;
  keywords?: string;
  whatsNew?: string;
  /** When false, whatsNew is omitted from save requests. */
  includeWhatsNew?: boolean;
}

export interface AppleApiError {
  errors?: Array<{
    status: string;
    code: string;
    title: string;
    detail: string;
  }>;
}
