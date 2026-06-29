/** App Store Connect metadata character limits. */
export const METADATA_FIELD_LIMITS = {
  name: 30,
  subtitle: 30,
  description: 4000,
  keywords: 100,
  whatsNew: 4000,
} as const;

export type MetadataTranslatableField = keyof typeof METADATA_FIELD_LIMITS;
