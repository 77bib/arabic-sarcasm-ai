"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";

const SARCASTIC_EXAMPLES = [
  "أكيد الانترنت رائع اليوم وهو مقطوع 😂",
  "يا سلام على المكيف وهو خربان طول الأسبوع",
  "رائع جدا، المشروع فشل للمره العاشره",
  "طبعا الخدمة سريعة، انتظرنا ساعتين بس",
  "واو، تحديث جديد كسر كل شيء مرة ثانية",
];

const NORMAL_EXAMPLES = [
  "الجو جميل اليوم",
  "شكرا على مساعدتك السريعة",
  "هذا القرار كان موفقا",
  "سأصل بعد عشر دقائق",
  "الاجتماع كان منظما وواضحا",
];

const SOCIAL_EXAMPLES = [
  "طابور ساعتين عشان تذكرة؟ تجربة رائعة فعلا",
  "المقهى مزدحم جدا لكنه على الاقل هادئ",
  "خدمة العملاء ردت بسرعة بعد ثلاثة أيام",
];

const POLITICAL_EXAMPLES = [
  "أكيد الوعود هذه المرة ستتحقق كلها",
  "نعم طبعا، الميزانية تكفي لكل شيء",
  "يا سلام على القرارات المفاجئة",
];

const GAMING_EXAMPLES = [
  "اللعبة ممتازة جدا، تعليق كل خمس دقائق",
  "سيرفرات مستقرة طول الوقت 😅",
  "تحديث صغير حذف الحفظ كله",
];

const SARCASM_WORDS = [
  "يا سلام",
  "أكيد",
  "طبعاً",
  "طبعا",
  "رائع جداً",
  "ممتاز كالعادة",
  "رائع",
  "ممتاز",
  "واو",
];
const EMOJI_SIGNAL = ["😂", "🤡", "💀", "😭", "😏"];

const LOADER_STEPS = [
  "جاري تحليل السياق...",
  "اكتشاف النبرة...",
  "تحليل البنية اللغوية...",
  "فهم التناقضات المحتملة...",
];

function normalizeArabic(text) {
  return text
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function removeRepeated(text) {
  return text.replace(/([\u0621-\u064A])\1{2,}/g, "$1$1");
}

function detectEmojis(text) {
  const matches = text.match(/[\p{Extended_Pictographic}]/gu);
  return matches || [];
}

function detectRepeatedLetters(text) {
  const matches = text.match(/([\u0621-\u064A])\1{2,}/g);
  return matches || [];
}

function detectContradictions(text) {
  const positive = /رائع|ممتاز|جميل|مذهل|مثالي/;
  const negative = /سيئ|خربان|فاشل|مقطوع|كارثي/;

  if (positive.test(text) && negative.test(text)) {
    return ["وجود كلمات مدح مع كلمات سلبية في نفس الجملة"];
  }
  return [];
}

function getSuspiciousWords(text) {
  return SARCASM_WORDS.filter((word) => text.includes(word));
}

function formatConfidence(score) {
  if (typeof score !== "number") return "-";
  if (score <= 1) {
    return `${(score * 100).toFixed(1)}%`;
  }
  return `${score.toFixed(2)}%`;
}

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function highlightText(text, highlights) {
  if (!highlights.length) return text;
  let result = text;
  highlights.forEach((word) => {
    const safe = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`(${safe})`, "g"),
      "<mark class=\"bg-sapphire/20 text-sapphire dark:text-sapphire px-1 rounded-md neon-ring\">$1</mark>"
    );
  });
  return result;
}

function buildExplanation({ contradictions, suspiciousWords, emojis, repeats, confidence, labelType }) {
  const reasons = [];
  if (labelType === "sarcasm" && typeof confidence === "number") {
    reasons.push("ثقة النموذج مرتفعة، ونلاحظ مؤشرات لغوية مساعدة");
  }
  if (contradictions.length) {
    reasons.push("تم رصد تناقض بين كلمات المدح والواقع");
  }
  if (suspiciousWords.length) {
    reasons.push("كلمات ساخرة شائعة ظهرت في النص");
  }
  if (emojis.length) {
    reasons.push("رموز تعبيرية ساخرة تزيد الاحتمالية");
  }
  if (repeats.length) {
    reasons.push("تكرار الحروف يوحي بالمبالغة");
  }
  if (confidence > 90) {
    reasons.push("المؤشرات اللغوية قوية نسبيا");
  }
  return reasons;
}

function classifyLabel(label = "") {
  const normalized = label.toLowerCase();
  if (normalized.includes("sarcasm") || normalized.includes("sarcastic")) {
    return "sarcasm";
  }
  if (normalized.includes("not") || normalized.includes("non")) {
    return "not_sarcasm";
  }
  if (normalized.includes("label_1")) return "sarcasm";
  if (normalized.includes("label_0")) return "not_sarcasm";
  if (normalized.includes("ليست")) return "not_sarcasm";
  if (normalized.includes("سخر")) return "sarcasm";
  return "unknown";
}

function useHistory() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem("sarcasm-history");
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch (error) {
        setItems([]);
      }
    }
  }, []);

  const update = useCallback((next) => {
    setItems(next);
    localStorage.setItem("sarcasm-history", JSON.stringify(next));
  }, []);

  return [items, update];
}

export default function HomePage() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("single");
  const [batchInput, setBatchInput] = useState("");
  const [batchResults, setBatchResults] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [batchError, setBatchError] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [apiStatus, setApiStatus] = useState("ready");
  const [history, setHistory] = useHistory();
  const [loaderStep, setLoaderStep] = useState(0);
  const requestRef = useRef(0);
  const resultsRef = useRef(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const glowX = useSpring(mouseX, { stiffness: 120, damping: 30 });
  const glowY = useSpring(mouseY, { stiffness: 120, damping: 30 });

  const debouncedInput = useDebouncedValue(input, 800);
  const normalizedInput = useMemo(() => normalizeArabic(input), [input]);
  const cleanedInput = useMemo(() => removeRepeated(normalizedInput), [normalizedInput]);

  const wordCount = useMemo(() => (normalizedInput ? normalizedInput.split(" ").length : 0), [normalizedInput]);
  const suspiciousWords = useMemo(() => getSuspiciousWords(input), [input]);
  const emojis = useMemo(() => detectEmojis(input), [input]);
  const repeats = useMemo(() => detectRepeatedLetters(input), [input]);
  const contradictions = useMemo(() => detectContradictions(input), [input]);

  const rawLabel = result?.predictionAr || result?.prediction || result?.label || "";
  const labelType = classifyLabel(rawLabel);
  const displayConfidence = typeof result?.confidence === "number" ? result.confidence : null;
  const rawOutput = useMemo(() => {
    const data = result?.result;
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0][0] || null;
    }
    if (Array.isArray(data)) {
      return data[0] || null;
    }
    return null;
  }, [result]);

  const explanation = useMemo(
    () => buildExplanation({
      contradictions,
      suspiciousWords,
      emojis,
      repeats,
      confidence: displayConfidence,
      labelType,
    }),
    [contradictions, suspiciousWords, emojis, repeats, displayConfidence, labelType]
  );

  const highlightedText = useMemo(
    () => highlightText(input, [...suspiciousWords, ...contradictions.length ? ["مقطوع"] : []]),
    [input, suspiciousWords, contradictions]
  );

  const batchLines = useMemo(() => {
    return batchInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [batchInput]);

  const batchStats = useMemo(() => {
    const total = batchResults.length;
    const sarcasmCount = batchResults.filter((item) => item.labelType === "sarcasm").length;
    const notSarcasmCount = batchResults.filter((item) => item.labelType === "not_sarcasm").length;
    const confidenceValues = batchResults
      .map((item) => item.confidence)
      .filter((value) => typeof value === "number");
    const averageConfidence = confidenceValues.length
      ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(2))
      : null;

    return { total, sarcasmCount, notSarcasmCount, averageConfidence };
  }, [batchResults]);

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => {
      setLoaderStep((prev) => (prev + 1) % LOADER_STEPS.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    function handleMove(event) {
      mouseX.set(event.clientX - 160);
      mouseY.set(event.clientY - 160);
    }

    window.addEventListener("pointermove", handleMove);
    return () => window.removeEventListener("pointermove", handleMove);
  }, [mouseX, mouseY]);

  const runPrediction = useCallback(
    async (text, { silent } = {}) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      if (!silent) {
        setLoading(true);
      }
      setError("");
      setInfo("");

      try {
        const response = await fetch("/api/predict", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: text }),
        });

        const data = await response.json();

        if (requestRef.current !== requestId) {
          return;
        }

        if (response.status === 503 && data?.status === "loading") {
          setInfo(data?.message || "النموذج يقوم بالتحميل حاليا...");
          setApiStatus("sleeping");
          return;
        }

        if (!response.ok) {
          setError(data?.message || data?.error || "حدث خطأ غير متوقع.");
          setApiStatus("offline");
          return;
        }

        setApiStatus("online");
        setResult(data);
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        if (!silent) {
          const newItem = {
            text,
            prediction: data?.predictionAr || data?.prediction || "",
            confidence: data?.confidence ?? null,
            timestamp: new Date().toISOString(),
          };

          const filtered = history.filter((item) => item.text !== text);
          setHistory([newItem, ...filtered].slice(0, 8));
        }
      } catch (err) {
        if (requestRef.current !== requestId) {
          return;
        }
        setError("تعذر الاتصال بالخادم.");
        setApiStatus("offline");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [history, setHistory]
  );

  useEffect(() => {
    if (!debouncedInput || debouncedInput.length < 4) return;
    runPrediction(debouncedInput, { silent: true });
  }, [debouncedInput, runPrediction]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (input.trim()) {
          runPrediction(input, { silent: false });
        }
      }
      if (event.ctrlKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setInput("");
        setResult(null);
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        if (result) {
          navigator.clipboard.writeText(
            `النتيجة: ${rawLabel} | الثقة: ${formatConfidence(displayConfidence)}`
          );
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [input, result, rawLabel, displayConfidence, runPrediction]);

  const onSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (!input.trim()) {
        setError("من فضلك اكتب نصا عربيا للتجربة.");
        return;
      }
      runPrediction(input, { silent: false });
    },
    [input, runPrediction]
  );

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(
      JSON.stringify({
        text: input,
        prediction: rawLabel,
        confidence: displayConfidence,
      })
    );
  }, [result, input, rawLabel, displayConfidence]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const blob = new Blob([
      JSON.stringify({ text: input, prediction: rawLabel, confidence: displayConfidence }, null, 2),
    ], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sarcasm-analysis.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [result, input, rawLabel, displayConfidence]);

  const exportBatch = useCallback((format) => {
    if (!batchResults.length) return;

    if (format === "json") {
      const blob = new Blob([
        JSON.stringify(batchResults, null, 2),
      ], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sarcasm-batch-results.json";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const header = "sentence,prediction,confidence";
    const rows = batchResults.map((item) => {
      const sentence = `"${(item.text || "").replace(/"/g, '""')}"`;
      const prediction = `"${(item.prediction || "").replace(/"/g, '""')}"`;
      const confidence = typeof item.confidence === "number" ? item.confidence : "";
      return [sentence, prediction, confidence].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const csvBlob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const csvUrl = URL.createObjectURL(csvBlob);
    const csvLink = document.createElement("a");
    csvLink.href = csvUrl;
    csvLink.download = "sarcasm-batch-results.csv";
    csvLink.click();
    URL.revokeObjectURL(csvUrl);
  }, [batchResults]);

  const statusBadge = apiStatus === "online"
    ? "جاهز"
    : apiStatus === "sleeping"
    ? "النموذج نائم"
    : "غير متصل";

  const runBatchAnalysis = useCallback(async () => {
    setBatchError("");
    const lines = batchLines.slice(0, 50);
    if (!lines.length) {
      setBatchError("أضف جملة واحدة على الأقل.");
      return;
    }

    setBatchLoading(true);
    setBatchResults([]);
    setBatchProgress({ done: 0, total: lines.length });

    const results = new Array(lines.length);
    let nextIndex = 0;
    let active = 0;

    const runNext = () => {
      while (active < 3 && nextIndex < lines.length) {
        const index = nextIndex;
        const sentence = lines[nextIndex];
        nextIndex += 1;
        active += 1;

        fetch("/api/predict", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: sentence }),
        })
          .then(async (response) => {
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data?.message || "تعذر تحليل الجملة.");
            }
            const label = data?.predictionAr || data?.prediction || "";
            const labelType = classifyLabel(label);
            return {
              text: sentence,
              prediction: label,
              confidence: typeof data?.confidence === "number" ? data.confidence : null,
              labelType,
              raw: data?.result ?? null,
            };
          })
          .catch((error) => {
            return {
              text: sentence,
              prediction: "خطأ",
              confidence: null,
              labelType: "unknown",
              error: error?.message || "تعذر التحليل",
            };
          })
          .then((item) => {
            results[index] = item;
          })
          .finally(() => {
            active -= 1;
            setBatchProgress((prev) => ({
              done: Math.min(prev.done + 1, lines.length),
              total: prev.total,
            }));
            if (nextIndex >= lines.length && active === 0) {
              setBatchResults(results.filter(Boolean));
              setBatchLoading(false);
            } else {
              runNext();
            }
          });
      }
    };

    runNext();
  }, [batchLines]);

  return (
    <div className={darkMode ? "dark" : ""}>
      <main className="relative min-h-screen overflow-hidden gradient-shell ai-grid">
        <div className="particle-layer" />
        <div className="orb-layer">
          <span className="orb orb-blue" style={{ top: "-4%", left: "5%" }} />
          <span className="orb orb-violet" style={{ top: "12%", right: "8%" }} />
          <span className="orb orb-mint" style={{ bottom: "-10%", left: "40%" }} />
        </div>
        <motion.div
          className="mouse-glow"
          style={{ x: glowX, y: glowY }}
        />
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12">
          <header className="relative flex flex-col gap-8">
            <div className="absolute inset-x-0 -top-8 h-24 rounded-full bg-sapphire/10 blur-3xl" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="inline-flex items-center gap-2 rounded-full border border-sapphire/30 bg-white/60 px-4 py-2 text-xs text-sapphire shadow-sm dark:border-sapphire/40 dark:bg-white/10"
                >
                  <span className="h-2 w-2 rounded-full bg-sapphire shadow-[0_0_12px_rgba(26,77,255,0.9)]" />
                  مختبر ذكاء اصطناعي حي
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                  className="mt-4 text-3xl font-bold text-ink dark:text-mist md:text-5xl"
                >
                  محلل السخرية العربية بالذكاء الاصطناعي
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                  className="mt-4 max-w-2xl text-base text-ink/70 dark:text-mist/70"
                >
                  تجربة تحليل فورية بواجهة سينمائية تجمع الذكاء الاصطناعي واللغة العربية بدقة عالية.
                </motion.p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => document.getElementById("ai-input")?.focus()}
                    className="glow-border rounded-2xl bg-sapphire px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
                  >
                    ابدأ التحليل الآن
                  </button>
                  <span className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-xs text-ink/70 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-mist/70">
                    منصة AI عربية بواجهة SaaS احترافية
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-sapphire/30 bg-white/60 px-3 py-1 text-xs text-sapphire shadow-sm dark:border-sapphire/40 dark:bg-white/10">
                  الحالة: {statusBadge}
                </span>
                <button
                  type="button"
                  onClick={() => setDarkMode((prev) => !prev)}
                  className="rounded-full border border-ink/20 bg-white/70 px-4 py-2 text-sm text-ink shadow-sm transition hover:shadow-lg dark:border-mist/30 dark:bg-white/10 dark:text-mist"
                >
                  {darkMode ? "الوضع الفاتح" : "الوضع الداكن"}
                </button>
              </div>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="glass neon-ring glow-border card-float rounded-3xl border border-white/30 bg-white/70 p-6 shadow-glow dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/60 p-2 text-xs text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-mist/70">
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className={`rounded-2xl px-4 py-2 transition ${
                    mode === "single"
                      ? "bg-sapphire text-white shadow-glow"
                      : "hover:bg-white/70 dark:hover:bg-white/10"
                  }`}
                >
                  تحليل فردي
                </button>
                <button
                  type="button"
                  onClick={() => setMode("batch")}
                  className={`rounded-2xl px-4 py-2 transition ${
                    mode === "batch"
                      ? "bg-sapphire text-white shadow-glow"
                      : "hover:bg-white/70 dark:hover:bg-white/10"
                  }`}
                >
                  تحليل دفعات
                </button>
              </div>

              {mode === "single" ? (
                <form onSubmit={onSubmit} className="flex h-full flex-col gap-5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-ink/70 dark:text-mist/70">
                    نص الاختبار
                  </label>
                  <span className="text-xs text-ink/50 dark:text-mist/50">Enter للتحليل - Ctrl+L للمسح</span>
                </div>
                <div className="relative">
                  <textarea
                    id="ai-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    rows={7}
                    placeholder="اكتب جملة عربية هنا..."
                    className="w-full resize-none rounded-2xl border border-ink/10 bg-white/80 p-4 text-lg text-ink shadow-sm outline-none transition focus:border-sapphire focus:ring-2 focus:ring-sapphire/20 dark:border-white/10 dark:bg-white/10 dark:text-mist"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-sapphire/30 opacity-0 transition focus-within:opacity-100" />
                  <AnimatePresence>
                    {loading ? (
                      <motion.div
                        key="scanline"
                        initial={{ opacity: 0, x: "-10%" }}
                        animate={{ opacity: 1, x: "110%" }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                        className="pointer-events-none absolute top-2 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-sapphire/70 to-transparent"
                      />
                    ) : null}
                  </AnimatePresence>
                </div>
                <div className="flex items-center justify-between text-sm text-ink/60 dark:text-mist/60">
                  <span>عدد الحروف: {input.length}</span>
                  <span>عدد الكلمات: {wordCount}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-sapphire px-6 py-3 text-base font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        جاري التحليل...
                      </span>
                    ) : (
                      "تحليل السخرية"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-sm text-ink transition hover:border-sapphire/40 hover:text-sapphire dark:border-white/10 dark:bg-white/10 dark:text-mist"
                  >
                    نسخ النتيجة
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-sm text-ink transition hover:border-mint/40 hover:text-mint dark:border-white/10 dark:bg-white/10 dark:text-mist"
                  >
                    تصدير JSON
                  </button>
                </div>

                <AnimatePresence>
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-2xl border border-sapphire/30 bg-sapphire/10 p-4 text-sm text-sapphire"
                    >
                      {LOADER_STEPS[loaderStep]}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {error ? (
                  <div className="rounded-2xl border border-coral/40 bg-coral/10 p-4 text-sm text-coral">
                    {error}
                  </div>
                ) : null}
                {info ? (
                  <div className="rounded-2xl border border-sapphire/30 bg-sapphire/10 p-4 text-sm text-sapphire">
                    {info}
                  </div>
                ) : null}
                </form>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-ink/70 dark:text-mist/70">
                      نصوص متعددة (سطر لكل جملة)
                    </label>
                    <span className="text-xs text-ink/50 dark:text-mist/50">
                      الحد الحالي: 50 جملة لكل تشغيل
                    </span>
                  </div>
                  <div className="relative">
                    <textarea
                      value={batchInput}
                      onChange={(event) => setBatchInput(event.target.value)}
                      rows={9}
                      placeholder="أدخل كل جملة في سطر منفصل..."
                      className="w-full resize-none rounded-2xl border border-ink/10 bg-white/80 p-4 text-base text-ink shadow-sm outline-none transition focus:border-sapphire focus:ring-2 focus:ring-sapphire/20 dark:border-white/10 dark:bg-white/10 dark:text-mist"
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-sapphire/30 opacity-0 transition focus-within:opacity-100" />
                  </div>
                  <div className="flex items-center justify-between text-sm text-ink/60 dark:text-mist/60">
                    <span>عدد الأسطر: {batchLines.length}</span>
                    <span>الحد الأقصى: 50</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={batchLoading}
                      onClick={() => runBatchAnalysis()}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-sapphire px-6 py-3 text-base font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {batchLoading ? "جاري التحليل" : "تحليل الدفعات"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchInput("");
                        setBatchResults([]);
                        setBatchProgress({ done: 0, total: 0 });
                      }}
                      className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-sm text-ink transition hover:border-sapphire/40 hover:text-sapphire dark:border-white/10 dark:bg-white/10 dark:text-mist"
                    >
                      مسح الدفعة
                    </button>
                  </div>

                  {batchLoading ? (
                    <div className="rounded-2xl border border-sapphire/30 bg-sapphire/10 p-4 text-sm text-sapphire">
                      يتم تحليل {batchProgress.done} من {batchProgress.total}
                      <div className="mt-3 h-2 rounded-full bg-ink/10 dark:bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: batchProgress.total
                              ? `${(batchProgress.done / batchProgress.total) * 100}%`
                              : "0%",
                          }}
                          transition={{ duration: 0.5 }}
                          className="h-2 rounded-full bg-sapphire"
                        />
                      </div>
                    </div>
                  ) : null}
                  {batchError ? (
                    <div className="rounded-2xl border border-coral/40 bg-coral/10 p-4 text-sm text-coral">
                      {batchError}
                    </div>
                  ) : null}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass rounded-3xl border border-white/30 bg-white/70 p-6 shadow-glow dark:border-white/10 dark:bg-white/5"
            >
              <h2 className="text-lg font-semibold text-ink dark:text-mist">نماذج جاهزة</h2>
              <div className="mt-4 space-y-4">
                {[
                  {
                    title: "ساخرة",
                    items: SARCASTIC_EXAMPLES,
                    toneClasses: "hover:border-sapphire/40 hover:text-sapphire",
                  },
                  {
                    title: "عادية",
                    items: NORMAL_EXAMPLES,
                    toneClasses: "hover:border-mint/40 hover:text-mint",
                  },
                  {
                    title: "اجتماعية",
                    items: SOCIAL_EXAMPLES,
                    toneClasses: "hover:border-coral/40 hover:text-coral",
                  },
                  {
                    title: "سياسية",
                    items: POLITICAL_EXAMPLES,
                    toneClasses: "hover:border-sapphire/40 hover:text-sapphire",
                  },
                  {
                    title: "Gaming",
                    items: GAMING_EXAMPLES,
                    toneClasses: "hover:border-mint/40 hover:text-mint",
                  },
                ].map((group) => (
                  <div key={group.title}>
                    <p className="text-sm font-semibold text-ink/70 dark:text-mist/70">
                      {group.title}
                    </p>
                    <div className="mt-2 grid gap-2">
                      {group.items.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => setInput(example)}
                          className={`rounded-2xl border border-ink/10 bg-white/90 px-4 py-2 text-right text-sm text-ink transition ${group.toneClasses} dark:border-white/10 dark:bg-white/10 dark:text-mist`}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-col gap-6">
              <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="glass glow-border rounded-3xl border border-white/30 bg-white/70 p-6 shadow-glow dark:border-white/10 dark:bg-white/5"
              ref={resultsRef}
            >
              <h2 className="text-lg font-semibold text-ink dark:text-mist">التوقع الرسمي للنموذج</h2>
              {result ? (
                <div className="mt-5 space-y-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className={`pulse-ring rounded-full px-4 py-1 text-sm text-white ${
                        labelType === "sarcasm"
                          ? "bg-coral shadow-[0_0_30px_rgba(255,107,107,0.4)]"
                          : "bg-sapphire shadow-[0_0_30px_rgba(26,77,255,0.35)]"
                      }`}
                    >
                      {rawLabel || "غير متوفر"}
                    </motion.span>
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.05 }}
                      className={`rounded-full px-4 py-1 text-sm font-semibold ${
                        labelType === "sarcasm"
                          ? "bg-coral/15 text-coral"
                          : labelType === "not_sarcasm"
                          ? "bg-mint/15 text-mint"
                          : "bg-ink/10 text-ink dark:bg-white/10 dark:text-mist"
                      }`}
                    >
                      {labelType === "sarcasm"
                        ? "سخرية"
                        : labelType === "not_sarcasm"
                        ? "ليست سخرية"
                        : "غير معروف"}
                    </motion.span>
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="rounded-full bg-sapphire/10 px-4 py-1 text-sm text-sapphire"
                    >
                      الثقة: {formatConfidence(displayConfidence)}
                    </motion.span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-ink/10 bg-white/60 p-4 text-sm text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-mist/70">
                      <p className="font-semibold text-ink dark:text-mist">مؤشر الثقة (ناتج النموذج)</p>
                      <div className="mt-3 flex items-center gap-4">
                        <div
                          className="relative h-20 w-20 rounded-full"
                          style={{
                            background: `conic-gradient(${labelType === "sarcasm" ? "#ff6b6b" : "#37d39a"} ${Math.min(displayConfidence || 0, 100)}%, rgba(255,255,255,0.15) 0)`
                          }}
                        >
                          <div className="absolute inset-2 rounded-full bg-white/80 dark:bg-ink" />
                          <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-ink dark:text-mist">
                            {displayConfidence ? `${displayConfidence.toFixed(1)}%` : "-"}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-ink/70 dark:text-mist/70">تصنيف النموذج</p>
                          <p className="mt-1 text-base font-semibold text-ink dark:text-mist">
                            {rawLabel || "-"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-ink/10 dark:bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: displayConfidence
                              ? `${Math.min(displayConfidence, 100)}%`
                              : "0%",
                          }}
                          transition={{ duration: 0.9, ease: "easeOut" }}
                          className={`h-2 rounded-full ${
                            labelType === "sarcasm"
                              ? "bg-coral"
                              : "bg-sapphire"
                          }`}
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white/60 p-4 text-sm text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-mist/70">
                      <p className="font-semibold text-ink dark:text-mist">ملاحظات رسمية</p>
                      <p className="mt-2 text-xs text-ink/50 dark:text-mist/50">
                        هذا القسم يعرض فقط مخرجات النموذج الرسمية دون أي تحليلات إضافية.
                      </p>
                    </div>
                  </div>


                </div>
              ) : (
                <p className="mt-4 text-sm text-ink/60 dark:text-mist/60">
                  اكتب نصا ثم اضغط تحليل السخرية لرؤية النتائج.
                </p>
              )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="glass rounded-3xl border border-white/30 bg-ink/90 p-6 shadow-glow dark:border-white/10"
              >
                <h3 className="text-base font-semibold text-mist">Model Technical Output</h3>
                <details className="mt-4 rounded-2xl border border-white/10 bg-black/60 p-4 text-sm text-mist/80">
                  <summary className="cursor-pointer text-sm font-semibold text-mist">
                    عرض التفاصيل التقنية
                  </summary>
                  <div className="mt-3 space-y-2 text-xs text-mist/70">
                    <div>label: {rawOutput?.label || "-"}</div>
                    <div>score: {typeof rawOutput?.score === "number" ? rawOutput.score.toFixed(4) : "-"}</div>
                    <div>latency: غير متوفر</div>
                    <div>metadata: غير متوفر</div>
                    <pre className="mt-2 rounded-xl bg-black/60 p-3 text-[11px] text-mist">
                      {JSON.stringify(result?.result ?? {}, null, 2)}
                    </pre>
                  </div>
                </details>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass rounded-3xl border border-white/30 bg-white/70 p-6 shadow-glow dark:border-white/10 dark:bg-white/5"
            >
              <h2 className="text-lg font-semibold text-ink dark:text-mist">تحليل لغوي إضافي</h2>
              <p className="mt-2 text-xs text-ink/60 dark:text-mist/60">
                هذا القسم يعتمد على قواعد لغوية واستدلالات مساعدة، وليس مخرجات مباشرة من النموذج.
              </p>
              <div className="mt-4 space-y-4 text-sm text-ink/70 dark:text-mist/70">
                <div>
                  <p className="font-semibold text-ink dark:text-mist">أسباب لغوية محتملة</p>
                  <ul className="mt-2 space-y-2">
                    {explanation.length ? (
                      explanation.map((reason) => (
                        <li key={reason} className="rounded-xl bg-ink/5 p-2 dark:bg-white/10">
                          {reason}
                        </li>
                      ))
                    ) : (
                      <li className="rounded-xl bg-ink/5 p-2 dark:bg-white/10">لا توجد إشارات واضحة.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-ink dark:text-mist">كلمات ساخرة مشتبه بها</p>
                  <p>{suspiciousWords.length ? suspiciousWords.join("، ") : "لا يوجد"}</p>
                </div>
                <div>
                  <p className="font-semibold text-ink dark:text-mist">تناقضات لغوية</p>
                  <p>{contradictions.length ? contradictions.join("، ") : "لا يوجد"}</p>
                </div>
                <div>
                  <p className="font-semibold text-ink dark:text-mist">رموز تعبيرية</p>
                  <p>{emojis.length ? emojis.join(" ") : "لا يوجد"}</p>
                </div>
                <div>
                  <p className="font-semibold text-ink dark:text-mist">تكرار حروف</p>
                  <p>{repeats.length ? repeats.join("، ") : "لا يوجد"}</p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/60 p-4 text-sm text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-mist/70">
                  <p className="font-semibold text-ink dark:text-mist">النص مع إبراز الكلمات</p>
                  <p
                    className="mt-2 leading-7"
                    dangerouslySetInnerHTML={{ __html: highlightedText }}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-ink/10 bg-white/60 p-4 text-sm text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-mist/70">
                    <p className="font-semibold text-ink dark:text-mist">قبل المعالجة</p>
                    <p className="mt-2">{input || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-ink/10 bg-white/60 p-4 text-sm text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-mist/70">
                    <p className="font-semibold text-ink dark:text-mist">بعد المعالجة</p>
                    <p className="mt-2">{cleanedInput || "-"}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="glass rounded-3xl border border-white/30 bg-white/70 p-6 shadow-glow dark:border-white/10 dark:bg-white/5"
            >
              <h2 className="text-lg font-semibold text-ink dark:text-mist">سجل التحليلات</h2>
              <div className="mt-4 space-y-3">
                {history.length ? (
                  history.map((item) => (
                    <div key={item.timestamp} className="rounded-2xl border border-ink/10 bg-white/70 p-4 text-sm text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-mist/70">
                      <p className="font-semibold text-ink dark:text-mist">{item.text}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-ink px-3 py-1 text-white dark:bg-mist dark:text-ink">
                          {item.prediction || "-"}
                        </span>
                        <span className="rounded-full bg-sapphire/10 px-3 py-1 text-sapphire">
                          {formatConfidence(item.confidence)}
                        </span>
                        <span className="text-ink/50 dark:text-mist/50">
                          {new Date(item.timestamp).toLocaleString("ar")}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink/60 dark:text-mist/60">لا توجد نتائج محفوظة بعد.</p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass rounded-3xl border border-white/30 bg-white/70 p-6 shadow-glow dark:border-white/10 dark:bg-white/5"
            >
              <h2 className="text-lg font-semibold text-ink dark:text-mist">لوحة الحالة</h2>
              <div className="mt-4 space-y-3 text-sm text-ink/70 dark:text-mist/70">
                <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/10">
                  <span>API Online</span>
                  <span className={apiStatus === "online" ? "text-mint" : "text-ink/50 dark:text-mist/50"}>
                    {apiStatus === "online" ? "متصل" : "غير متصل"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/10">
                  <span>Space Sleeping</span>
                  <span className={apiStatus === "sleeping" ? "text-coral" : "text-ink/50 dark:text-mist/50"}>
                    {apiStatus === "sleeping" ? "نائم" : "جاهز"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/10">
                  <span>AI Ready</span>
                  <span className={apiStatus === "online" ? "text-mint" : "text-ink/50 dark:text-mist/50"}>
                    {apiStatus === "online" ? "نعم" : "بانتظار"}
                  </span>
                </div>
              </div>
            </motion.div>
          </section>

          {mode === "batch" ? (
            <section className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="grid gap-4 md:grid-cols-5"
              >
                {[
                  { label: "الإجمالي", value: batchStats.total },
                  { label: "سخرية", value: batchStats.sarcasmCount },
                  { label: "ليست سخرية", value: batchStats.notSarcasmCount },
                  { label: "متوسط الثقة", value: batchStats.averageConfidence ? `${batchStats.averageConfidence}%` : "-" },
                  { label: "التقدم", value: batchProgress.total ? `${batchProgress.done}/${batchProgress.total}` : "-" },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="glass rounded-2xl border border-white/30 bg-white/70 p-4 text-sm text-ink/70 shadow-glow dark:border-white/10 dark:bg-white/5 dark:text-mist/70"
                  >
                    <p className="text-xs text-ink/50 dark:text-mist/50">{card.label}</p>
                    <p className="mt-2 text-lg font-semibold text-ink dark:text-mist">{card.value}</p>
                  </div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="glass rounded-3xl border border-white/30 bg-white/70 p-6 shadow-glow dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink dark:text-mist">نتائج الدفعات</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportBatch("json")}
                      className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-2 text-xs text-ink transition hover:border-sapphire/40 hover:text-sapphire dark:border-white/10 dark:bg-white/10 dark:text-mist"
                    >
                      تصدير JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => exportBatch("csv")}
                      className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-2 text-xs text-ink transition hover:border-mint/40 hover:text-mint dark:border-white/10 dark:bg-white/10 dark:text-mist"
                    >
                      تصدير CSV
                    </button>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10 dark:border-white/10">
                  <div className="grid grid-cols-[2fr_0.8fr_0.6fr] gap-2 bg-ink/5 px-4 py-3 text-xs font-semibold text-ink/70 dark:bg-white/5 dark:text-mist/70">
                    <span>الجملة</span>
                    <span>التوقع</span>
                    <span>الثقة</span>
                  </div>
                  <div className="divide-y divide-ink/10 dark:divide-white/10">
                    {batchResults.length ? (
                      batchResults.map((item, index) => (
                        <motion.div
                          key={`${item.text}-${index}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.02 }}
                          className="grid grid-cols-[2fr_0.8fr_0.6fr] gap-2 bg-white/70 px-4 py-3 text-sm text-ink/80 hover:bg-white/90 dark:bg-white/5 dark:text-mist/80"
                        >
                          <span className="truncate">{item.text}</span>
                          <span
                            className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs ${
                              item.labelType === "sarcasm"
                                ? "bg-coral/15 text-coral"
                                : item.labelType === "not_sarcasm"
                                ? "bg-sapphire/15 text-sapphire"
                                : "bg-ink/10 text-ink dark:bg-white/10 dark:text-mist"
                            }`}
                          >
                            {item.prediction || "-"}
                          </span>
                          <span>{formatConfidence(item.confidence)}</span>
                        </motion.div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-ink/60 dark:text-mist/60">
                        لا توجد نتائج بعد.
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </section>
          ) : null}

          <footer className="text-sm text-ink/60 dark:text-mist/60">
            تجربة مستقبلية لتحليل السخرية العربية مع واجهة SaaS احترافية.
          </footer>
        </div>
      </main>
    </div>
  );
}
