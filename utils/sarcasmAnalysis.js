const POSITIVE_WORDS = ["رائع", "ممتاز", "جميل", "عظيم", "تحفة"];
const NEGATIVE_WORDS = ["فشل", "تعطل", "مقطوع", "كارثة", "مشكلة", "سيء"];

const COMPARISON_PATTERNS = ["مثل", "كأنه", "كأنها", "زي", "كما لو"];
const EXAGGERATION_PATTERNS = ["جدا", "للغاية", "أفضل شيء", "في العالم"];

const EMOJI_PATTERN = /[😂😏🤡💀😭]/;
const STRONG_PUNCT_PATTERN = /!!+|؟؟+|!!!+/;
const REPEATED_LETTER_PATTERN = /([\u0621-\u064A])\1{2,}/;

function normalizeArabic(text = "") {
  return text
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, list) {
  return list.some((word) => text.includes(word));
}

function detectSarcasmType(text = "") {
  const normalized = normalizeArabic(text);

  if (normalized.includes("؟")) {
    return "Rhetorical Question";
  }

  if (hasAny(normalized, COMPARISON_PATTERNS)) {
    return "Ironical Comparison";
  }

  if (hasAny(normalized, EXAGGERATION_PATTERNS) || REPEATED_LETTER_PATTERN.test(normalized)) {
    return "Exaggeration";
  }

  const hasPositive = hasAny(normalized, POSITIVE_WORDS);
  const hasNegative = hasAny(normalized, NEGATIVE_WORDS);
  if (hasPositive && hasNegative) {
    return "Contrast";
  }

  return "Unknown";
}

function normalizeConfidence(confidence) {
  if (typeof confidence !== "number") return null;
  return confidence > 1 ? confidence / 100 : confidence;
}

function baseIntensity(confidence) {
  if (confidence >= 0.85) return 5;
  if (confidence >= 0.7) return 4;
  if (confidence >= 0.55) return 3;
  if (confidence >= 0.4) return 2;
  return 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function analyzeSarcasm(text = "", prediction = "", confidenceValue = null) {
  const normalized = normalizeArabic(text);
  const confidence = normalizeConfidence(confidenceValue);
  const sarcasmType = detectSarcasmType(normalized);

  const emojiDetected = EMOJI_PATTERN.test(normalized);
  const questionDetected = normalized.includes("؟");
  const comparisonDetected = hasAny(normalized, COMPARISON_PATTERNS);
  const exaggerationDetected = hasAny(normalized, EXAGGERATION_PATTERNS) || REPEATED_LETTER_PATTERN.test(normalized);
  const contrastDetected = hasAny(normalized, POSITIVE_WORDS) && hasAny(normalized, NEGATIVE_WORDS);
  const repeatedLetters = REPEATED_LETTER_PATTERN.test(normalized);

  let intensity = confidence === null ? 1 : baseIntensity(confidence);

  if (emojiDetected) intensity += 1;
  if (STRONG_PUNCT_PATTERN.test(normalized)) intensity += 1;
  if (exaggerationDetected) intensity += 1;
  if (repeatedLetters) intensity += 1;

  intensity = clamp(intensity, 1, 5);

  return {
    prediction,
    confidence: confidence ?? null,
    sarcasmType,
    intensity,
    heuristics: {
      emoji_detected: emojiDetected,
      question_detected: questionDetected,
      comparison_detected: comparisonDetected,
      exaggeration_detected: exaggerationDetected,
      contrast_detected: contrastDetected,
      repeated_letters: repeatedLetters,
    },
  };
}

export { analyzeSarcasm };
