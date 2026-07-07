import {
  GoogleGenerativeAI,
  FunctionCallingMode,
  FunctionCall,
  Part,
  FunctionDeclaration,
} from '@google/generative-ai';

const FALLBACK_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

export interface GeminiCallConfig {
  prompt: string;
  declaration: FunctionDeclaration;
  allowedFunctionName: string;
  temperature?: number;
  screenshot?: { mimeType: string; data: string };
}

export async function callGeminiWithFallback(config: GeminiCallConfig): Promise<FunctionCall> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  const client = new GoogleGenerativeAI(apiKey);
  const defaultModelName = (process.env.GEMINI_MODEL || (config.screenshot ? 'gemini-2.0-flash' : 'gemini-2.0-flash')).trim();
  const fallbackNames = FALLBACK_MODELS.filter((m) => m !== defaultModelName);
  const candidates = [...new Set([defaultModelName, ...fallbackNames])];

  let lastError: Error | null = null;

  for (const modelName of candidates) {
    try {
      console.log(`[GeminiService] Attempting ${config.allowedFunctionName} using model: ${modelName}`);
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: config.temperature ?? 0.1,
        },
      });

      const parts: Part[] = [];
      if (config.screenshot) {
        parts.push({ inlineData: config.screenshot });
      }
      parts.push({ text: config.prompt });

      const response = await model.generateContent({
        contents: [{ role: 'user', parts }],
        tools: [{ functionDeclarations: [config.declaration] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingMode.ANY,
            allowedFunctionNames: [config.allowedFunctionName],
          },
        },
      });

      const functionCalls =
        typeof response.response.functionCalls === 'function'
          ? response.response.functionCalls()
          : undefined;
      let call: FunctionCall | undefined = functionCalls?.[0];

      if (!call) {
        const candidateParts: Part[] = response.response.candidates?.[0]?.content?.parts || [];
        for (const part of candidateParts) {
          if (part.functionCall) {
            call = part.functionCall;
            break;
          }
        }
      }

      if (call && call.name === config.allowedFunctionName) {
        return call;
      }

      throw new Error(`Gemini failed to call the ${config.allowedFunctionName} function correctly`);
    } catch (err) {
      console.warn(`[GeminiService] ${config.allowedFunctionName} failed using ${modelName}:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown'}`);
}

export function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') return '';
  const clean = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return clean.slice(0, 200);
}

export function sanitizePayload(payload: any, depth = 0): any {
  if (depth > 4) return undefined;
  if (typeof payload === 'string') return sanitizeString(payload);
  if (Array.isArray(payload)) {
    return payload
      .map((item) => sanitizePayload(item, depth + 1))
      .filter((v) => v !== undefined);
  }
  if (payload !== null && typeof payload === 'object') {
    const obj: any = {};
    for (const key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const sanitized = sanitizePayload(payload[key], depth + 1);
        if (sanitized !== undefined) {
          obj[key] = sanitized;
        }
      }
    }
    return obj;
  }
  return payload;
}
