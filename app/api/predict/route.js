export const runtime = "nodejs";

const SPACE_BASE_URL = "https://77abib-sarcasm-api.hf.space";
const CONFIG_URL = `${SPACE_BASE_URL}/config`;
const GRADIO_QUEUE_BASE = `${SPACE_BASE_URL}/gradio_api/call`;
const REQUEST_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 2000;
const LABEL_MAP = {
  LABEL_0: { en: "Not Sarcasm", ar: "ليست سخرية" },
  LABEL_1: { en: "Sarcasm", ar: "سخرية" },
};

function normalizeArabic(text) {
  return text
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSsePayload(rawText) {
  const lines = rawText.split(/\r?\n/);
  let eventName = "";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.replace("event:", "").trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.replace("data:", "").trim());
    }
  }

  if (!dataLines.length) {
    return { event: eventName || null, data: null };
  }

  const lastData = dataLines[dataLines.length - 1];
  try {
    return { event: eventName || null, data: JSON.parse(lastData) };
  } catch (error) {
    return { event: eventName || null, data: null };
  }
}

export async function POST(request) {
  console.log("[SPACE CONFIG URL]", CONFIG_URL);

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return Response.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const inputs = typeof payload?.inputs === "string" ? payload.inputs : "";
  if (!inputs) {
    return Response.json(
      { message: "Please provide an Arabic text input." },
      { status: 400 }
    );
  }

  const normalized = normalizeArabic(inputs);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;

  try {
    const configResponse = await fetch(CONFIG_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    const configText = await configResponse.text();
    console.log("[SPACE CONFIG STATUS]", configResponse.status);

    if (!configResponse.ok) {
      return Response.json(
        {
          status: "error",
          message: "تعذر قراءة إعدادات Space.",
          details: { status: configResponse.status, raw: configText },
        },
        { status: configResponse.status }
      );
    }

    let configJson;
    try {
      configJson = configText ? JSON.parse(configText) : null;
    } catch (error) {
      return Response.json(
        {
          status: "error",
          message: "استجابة إعدادات غير صالحة من Space.",
          details: { raw: configText },
        },
        { status: 502 }
      );
    }

    const namedEndpoints = configJson?.named_endpoints || configJson?.dependencies || [];
    const apiName = configJson?.api_name || "predict";
    const resolvedApiName = namedEndpoints?.find?.((entry) => entry?.api_name === "predict")
      ? "predict"
      : apiName;

    const queueStartUrl = `${GRADIO_QUEUE_BASE}/${resolvedApiName}`;
    console.log("[SPACE QUEUE START URL]", queueStartUrl);
    console.log("[SPACE QUEUE START REQUEST]", JSON.stringify({ data: [normalized] }));

    const startResponse = await fetch(queueStartUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: [normalized] }),
      signal: controller.signal,
    });

    const startContentType = startResponse.headers.get("content-type") || "";
    const startRaw = await startResponse.text();
    console.log("[SPACE QUEUE START STATUS]", startResponse.status);
    console.log("[SPACE QUEUE START CONTENT-TYPE]", startContentType);

    if (!startResponse.ok) {
      return Response.json(
        {
          status: "error",
          message: "تعذر بدء طلب التنبؤ في Space.",
          details: { raw: startRaw, status: startResponse.status },
        },
        { status: startResponse.status }
      );
    }

    let startJson;
    try {
      startJson = startRaw ? JSON.parse(startRaw) : null;
    } catch (error) {
      return Response.json(
        {
          status: "error",
          message: "استجابة غير صالحة من خادم Spaces.",
          details: { raw: startRaw },
        },
        { status: 502 }
      );
    }

    const eventId = startJson?.event_id;
    if (!eventId) {
      return Response.json(
        {
          status: "error",
          message: "تعذر الحصول على معرف الطلب من Space.",
          details: startJson,
        },
        { status: 502 }
      );
    }

    const pollUrl = `${queueStartUrl}/${eventId}`;
    console.log("[SPACE QUEUE POLL URL]", pollUrl);

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const pollResponse = await fetch(pollUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      const pollContentType = pollResponse.headers.get("content-type") || "";
      const pollRaw = await pollResponse.text();
      console.log("[SPACE QUEUE POLL STATUS]", pollResponse.status);
      console.log("[SPACE QUEUE POLL CONTENT-TYPE]", pollContentType);

      let pollJson = null;
      let pollEvent = null;

      if (pollContentType.includes("application/json")) {
        try {
          pollJson = pollRaw ? JSON.parse(pollRaw) : null;
        } catch (error) {
          pollJson = null;
        }
      } else if (pollContentType.includes("text/event-stream")) {
        const ssePayload = parseSsePayload(pollRaw);
        pollJson = ssePayload.data;
        pollEvent = ssePayload.event;
      }

      if (!pollResponse.ok) {
        return Response.json(
          {
            status: "error",
            message: "تعذر قراءة نتيجة التنبؤ من Space.",
            details: { status: pollResponse.status, raw: pollRaw },
          },
          { status: pollResponse.status }
        );
      }

      const completedData = pollJson?.data || pollJson?.output || pollJson || null;
      const isCompleted = pollJson?.status === "completed" || pollEvent === "complete" || Array.isArray(completedData);

      if (!isCompleted) {
        continue;
      }

      const predictionList = Array.isArray(completedData)
        ? completedData[0]
        : [];
      const topPrediction = Array.isArray(predictionList)
        ? predictionList.sort((a, b) => b.score - a.score)[0]
        : null;

      const label = topPrediction?.label || "";
      const mappedLabel = LABEL_MAP[label] || { en: "Unknown", ar: "غير معروف" };
      const confidence = typeof topPrediction?.score === "number"
        ? Number((topPrediction.score * 100).toFixed(2))
        : null;
      const prediction = mappedLabel.en;

      return Response.json({
        status: "success",
        success: true,
        prediction,
        predictionAr: mappedLabel.ar,
        confidence,
        result: completedData,
      });
    }

    return Response.json(
      {
        status: "loading",
        message: "النموذج كبير الحجم وقد يستغرق بعض الوقت...",
      },
      { status: 503 }
    );
  } catch (error) {
    const isTimeout = error?.name === "AbortError";
    const message = isTimeout
      ? "انتهت مهلة الاتصال بخادم Spaces."
      : "تعذر الاتصال بخادم Spaces.";

    return Response.json(
      {
        status: "error",
        message,
        details: { cause: error?.message || "unknown" },
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
