import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { getModelConfig } from "../studio-config";

export function getGroqClient(apiKey?: string) {
  const token = apiKey || process.env.GROQ_API_KEY;
  if (!token) {
    throw new Error(
      "GROQ_API_KEY is required. Please provide a Groq token in settings or set it in your environment.",
    );
  }
  return createGroq({
    apiKey: token,
  });
}

/**
 * Drafting model (DRAFT_MODEL, default OpenAI GPT-OSS 120B).
 */
export function getPrimaryModel(apiKey?: string) {
  const groq = getGroqClient(apiKey);
  return groq(getModelConfig().draft);
}

/**
 * Fast utility model (FAST_MODEL, default OpenAI GPT-OSS 20B).
 * Used for keyword strategy and as the drafting fallback.
 */
export function getFastModel(apiKey?: string) {
  const groq = getGroqClient(apiKey);
  return groq(getModelConfig().fast);
}

export type ResilientGenerateParams = Omit<
  Parameters<typeof generateText>[0],
  "model"
> & {
  apiKey?: string;
  preferModel?: "primary" | "fast";
};

/**
 * Resilient generation orchestrator:
 * 1. Calls the drafting model (or the fast model if preferModel === 'fast').
 * 2. If a TPM 429 rate limit is encountered, dynamically pauses for the server-requested
 *    cooldown duration and retries.
 * 3. If the drafting model keeps failing, transparently executes on the fast model
 *    to guarantee uninterrupted service.
 */
export async function generateTextWithResilience(
  params: ResilientGenerateParams,
) {
  const groq = getGroqClient(params.apiKey);
  const models = getModelConfig();
  const primary = groq(models.draft);
  const fallback = groq(models.fast);

  const chosenModel = params.preferModel === "fast" ? fallback : primary;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await generateText({
        ...params,
        model: chosenModel,
      });
    } catch (err: any) {
      const msg = err?.message || "";
      const isRateLimit =
        msg.includes("Rate limit") ||
        msg.includes("429") ||
        msg.includes("TPM") ||
        msg.includes("OTPM");

      if (isRateLimit && attempt < maxAttempts) {
        // Parse server requested retry-after duration, e.g. "try again in 4.05s"
        const match = msg.match(/try again in ([0-9.]+)s/i);
        const waitMs = match
          ? Math.ceil(parseFloat(match[1]) * 1000) + 1200
          : attempt * 3000;
        console.warn(
          `[Groq Rate Limit] Attempt ${attempt} throttled on ${params.preferModel || "primary"}. Pausing for ${waitMs}ms before retry...`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      // If the drafting model failed, attempt the fast model
      if (chosenModel === primary) {
        console.warn(
          `[Groq Fallback] ${models.draft} failed; executing on ${models.fast} instead...`,
        );
        try {
          return await generateText({
            ...params,
            model: fallback,
          });
        } catch (fallbackErr: any) {
          throw fallbackErr;
        }
      }

      throw err;
    }
  }

  throw new Error(
    "Failed to generate text after multiple resilience attempts.",
  );
}

export async function testGroqConnection(
  apiKey: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const groq = createGroq({ apiKey });
    const model = groq(getModelConfig().fast);
    const result = await generateText({
      model,
      prompt: "Respond with 'OK' only.",
      maxTokens: 5,
    });
    if (result.text.includes("OK")) {
      return {
        success: true,
        message: "Groq API key validated successfully!",
      };
    }
    return { success: true, message: "Connected to Groq successfully." };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to authenticate with Groq.",
    };
  }
}
