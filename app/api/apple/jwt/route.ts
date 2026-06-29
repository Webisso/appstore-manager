import { NextResponse } from "next/server";
import { generateAppleJwt } from "@/lib/apple/auth";
import type { AppleCredentials } from "@/lib/apple/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AppleCredentials;

    if (!body.issuerId || !body.keyId || !body.privateKey) {
      return NextResponse.json(
        { error: "Issuer ID, Key ID, and private key are required." },
        { status: 400 }
      );
    }

    const token = await generateAppleJwt(body);

    return NextResponse.json({ token });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate JWT.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
