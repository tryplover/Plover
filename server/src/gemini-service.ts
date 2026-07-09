import { GoogleGenerativeAI, FunctionCallingMode, GenerateContentResponse } from '@google/generative-ai';

const FALLBACK_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

export async function executeGeminiWithFallback(
  apiKey: string,
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    tools?: any[];
    allowedFunctionNames?: string[];
  }
): Promise<GenerateContentResponse> {
  const client = new GoogleGenerativeAI(apiKey);
  const defaultModelName = (options.model || process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  const candidates = [defaultModelName, ...FALLBACK_MODELS.filter((m) => m !== defaultModelName)];

  let lastError: Error | null = null;

  for (const modelName of candidates) {
    try {
      console.log(`[GeminiService] Attempting request using model: ${modelName}`);
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: options.temperature ?? 0.1,
        },
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(options.tools ? { tools: options.tools } : {}),
        ...(options.tools && options.allowedFunctionNames
          ? {
              toolConfig: {
                functionCallingConfig: {
                  mode: FunctionCallingMode.ANY,
                  allowedFunctionNames: options.allowedFunctionNames,
                },
              },
            }
          : {}),
      });

      return result.response;
    } catch (err) {
      console.warn(`[GeminiService] Request failed using ${modelName}:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown'}`);
}

export async function executeGeminiVisionWithFallback(
  apiKey: string,
  prompt: string,
  screenshotBase64: string,
  options: {
    model?: string;
    temperature?: number;
    tools?: any[];
    allowedFunctionNames?: string[];
  }
): Promise<GenerateContentResponse> {
  const client = new GoogleGenerativeAI(apiKey);
  const defaultModelName = (options.model || process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash').trim();
  const candidates = [defaultModelName, ...FALLBACK_MODELS.filter((m) => m !== defaultModelName)];

  let lastError: Error | null = null;

  for (const modelName of candidates) {
    try {
      console.log(`[GeminiService] Attempting vision request using model: ${modelName}`);
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: options.temperature ?? 0.1,
        },
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
              { text: prompt },
            ],
          },
        ],
        ...(options.tools ? { tools: options.tools } : {}),
        ...(options.tools && options.allowedFunctionNames
          ? {
              toolConfig: {
                functionCallingConfig: {
                  mode: FunctionCallingMode.ANY,
                  allowedFunctionNames: options.allowedFunctionNames,
                },
              },
            }
          : {}),
      });

      return result.response;
    } catch (err) {
      console.warn(`[GeminiService] Vision request failed using ${modelName}:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown'}`);
}
