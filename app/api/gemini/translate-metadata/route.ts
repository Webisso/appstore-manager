import { NextResponse } from "next/server";
import { translateMetadata } from "@/lib/gemini/translate";

interface RequestBody {
  apiKey?: string;
  model?: string;
  sourceLocale?: string;
  targetLocale?: string;
  name?: string;
  subtitle?: string;
  description?: string;
  whatsNew?: string;
  includeWhatsNew?: boolean;
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

    if (!body.sourceLocale || !body.targetLocale) {
      return NextResponse.json(
        { error: "Source and target locales are required." },
        { status: 400 }
      );
    }

    const translation = await translateMetadata({
      apiKey: body.apiKey,
      model: body.model,
      sourceLocale: body.sourceLocale,
      targetLocale: body.targetLocale,
      name: body.name,
      subtitle: body.subtitle,
      description: body.description,
      whatsNew: body.whatsNew,
      includeWhatsNew: body.includeWhatsNew ?? false,
    });

    return NextResponse.json({ translation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Translation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
