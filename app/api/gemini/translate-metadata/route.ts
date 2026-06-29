import { NextResponse } from "next/server";
import {
  correctMetadataLimits,
  translateMetadataInitial,
  type MetadataTranslationResult,
} from "@/lib/gemini/translate";
import type { MetadataTranslatableField } from "@/lib/apple/metadata-limits";

interface RequestBody {
  apiKey?: string;
  model?: string;
  sourceLocale?: string;
  targetLocale?: string;
  name?: string;
  subtitle?: string;
  description?: string;
  keywords?: string;
  whatsNew?: string;
  includeWhatsNew?: boolean;
  fieldsToTranslate?: MetadataTranslatableField[];
  translationBase?: Record<MetadataTranslatableField, string>;
  action?: "translate" | "correct";
  translation?: MetadataTranslationResult;
  overLimitFields?: MetadataTranslatableField[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.apiKey || !body.model) {
      return NextResponse.json(
        { error: "Gemini API key and model are required." },
        { status: 400 }
      );
    }

    if (body.action === "correct") {
      if (!body.targetLocale || !body.translation || !body.overLimitFields?.length) {
        return NextResponse.json(
          { error: "Target locale, translation, and over-limit fields are required." },
          { status: 400 }
        );
      }

      const result = await correctMetadataLimits({
        apiKey: body.apiKey,
        model: body.model,
        targetLocale: body.targetLocale,
        translation: body.translation,
        overLimitFields: body.overLimitFields,
        includeWhatsNew: body.includeWhatsNew ?? false,
        translationBase: body.translationBase ?? {
          name: body.translation.name,
          subtitle: body.translation.subtitle,
          description: body.translation.description,
          keywords: body.translation.keywords,
          whatsNew: body.translation.whatsNew ?? "",
        },
      });

      return NextResponse.json({
        translation: result.translation,
        overLimitFields: result.overLimitFields,
      });
    }

    if (!body.sourceLocale || !body.targetLocale) {
      return NextResponse.json(
        { error: "Source and target locales are required." },
        { status: 400 }
      );
    }

    if (!body.fieldsToTranslate?.length || !body.translationBase) {
      return NextResponse.json(
        { error: "Fields to translate and translation base are required." },
        { status: 400 }
      );
    }

    const result = await translateMetadataInitial({
      apiKey: body.apiKey,
      model: body.model,
      sourceLocale: body.sourceLocale,
      targetLocale: body.targetLocale,
      name: body.name,
      subtitle: body.subtitle,
      description: body.description,
      keywords: body.keywords,
      whatsNew: body.whatsNew,
      includeWhatsNew: body.includeWhatsNew ?? false,
      fieldsToTranslate: body.fieldsToTranslate,
      translationBase: body.translationBase,
    });

    return NextResponse.json({
      translation: result.translation,
      overLimitFields: result.overLimitFields,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Translation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
