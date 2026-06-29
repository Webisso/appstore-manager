import { describe, expect, it } from "vitest";
import {
  findSourceLocalization,
  localizationMatchesSource,
  localeEquals,
  normalizeComparableText,
  translatableFieldMatchesSource,
} from "./localization-match";
import {
  buildFrogooLikeLocalizations,
  enUsFull,
  ptPtIdentical,
  ptPtTranslated,
  ptPtVersionOnly,
} from "./__fixtures__/localization-fixtures";

describe("localeEquals", () => {
  it("treats en-US and en-us as equal", () => {
    expect(localeEquals("en-US", "en-us")).toBe(true);
  });
});

describe("normalizeComparableText", () => {
  it("normalizes escaped newlines like the editor", () => {
    expect(normalizeComparableText("a\\nb")).toBe("a\nb");
  });
});

describe("translatableFieldMatchesSource", () => {
  it("matches when target field is empty and source has content", () => {
    expect(translatableFieldMatchesSource(undefined, "Frogoo")).toBe(true);
    expect(translatableFieldMatchesSource("", "Frogoo")).toBe(true);
  });

  it("does not match when target differs from source", () => {
    expect(translatableFieldMatchesSource("Other", "Frogoo")).toBe(false);
  });
});

describe("localizationMatchesSource", () => {
  it("matches pt-PT when all fields identical to en-US", () => {
    expect(localizationMatchesSource(ptPtIdentical, enUsFull)).toBe(true);
  });

  it("matches pt-PT when name/subtitle empty but description same (API split)", () => {
    expect(localizationMatchesSource(ptPtVersionOnly, enUsFull)).toBe(true);
  });

  it("matches when only name was translated but other fields still match source", () => {
    expect(localizationMatchesSource(ptPtTranslated, enUsFull)).toBe(true);
  });

  it("matches when only keywords still match source", () => {
    const translatedExceptKeywords = {
      ...ptPtIdentical,
      name: "Frogoo: Tempo de Ecrã",
      subtitle: "Foco diário",
      description: "Descrição traduzida",
      keywords: "focus,screen time,productivity",
    };
    expect(localizationMatchesSource(translatedExceptKeywords, enUsFull)).toBe(
      true
    );
  });

  it("does not match when all fields differ from source", () => {
    const fullyTranslated = {
      ...ptPtIdentical,
      name: "Frogoo: Tempo de Ecrã",
      subtitle: "Foco diário",
      description: "Descrição traduzida",
      keywords: "foco,tempo de ecrã",
    };
    expect(localizationMatchesSource(fullyTranslated, enUsFull)).toBe(false);
  });

  it("ignores whatsNew differences", () => {
    const withWhatsNew = {
      ...ptPtIdentical,
      whatsNew: "Bug fixes",
    };
    const sourceWithWhatsNew = {
      ...enUsFull,
      whatsNew: "Different notes",
    };
    expect(localizationMatchesSource(withWhatsNew, sourceWithWhatsNew)).toBe(
      true
    );
  });
});

describe("findSourceLocalization", () => {
  it("finds en-US in Frogoo-like app localizations", () => {
    const localizations = buildFrogooLikeLocalizations();
    const source = findSourceLocalization(localizations, "en-US");
    expect(source?.locale).toBe("en-US");
  });

  it("counts 9 untranslated locales matching en-US (pt-PT included)", () => {
    const localizations = buildFrogooLikeLocalizations();
    const source = findSourceLocalization(localizations, "en-US");
    expect(source).toBeDefined();

    const targets = localizations.filter(
      (l) => !localeEquals(l.locale, "en-US")
    );
    const matching = targets.filter((l) =>
      localizationMatchesSource(l, source!)
    );

    expect(matching.map((l) => l.locale)).toContain("pt-PT");
    expect(matching.length).toBe(9);
  });
});
