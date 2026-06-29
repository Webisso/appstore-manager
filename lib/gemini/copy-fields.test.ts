import { describe, expect, it } from "vitest";
import {
  getFieldsToTranslate,
  isPartialTranslation,
  mergeTranslationFields,
} from "./copy-fields";
import { enUsFull, ptPtIdentical } from "../__fixtures__/localization-fixtures";

describe("getFieldsToTranslate", () => {
  it("returns only keywords when other fields differ from source", () => {
    const deTranslated = {
      ...ptPtIdentical,
      locale: "de-DE",
      name: "Frogoo: Fokus",
      subtitle: "Täglich fokussiert",
      description: "Deutsche Beschreibung",
      keywords: enUsFull.keywords,
    };

    const fields = getFieldsToTranslate(deTranslated, enUsFull, false);
    expect(fields).toEqual(["keywords"]);
  });

  it("detects partial translation mode", () => {
    expect(isPartialTranslation(["keywords"], false)).toBe(true);
    expect(
      isPartialTranslation(["name", "subtitle", "description", "keywords"], false)
    ).toBe(false);
  });
});

describe("mergeTranslationFields", () => {
  it("keeps base values for fields not in AI response", () => {
    const base = {
      name: "German Name",
      subtitle: "German Sub",
      description: "German Desc",
      keywords: "focus,screen time",
      whatsNew: "",
    };

    const merged = mergeTranslationFields(
      base,
      { keywords: "fokus,screenzeit" },
      ["keywords"]
    );

    expect(merged.name).toBe("German Name");
    expect(merged.keywords).toBe("fokus,screenzeit");
  });
});
