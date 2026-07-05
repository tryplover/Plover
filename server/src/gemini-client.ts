import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type GenerateContentResult,
} from '@google/generative-ai';
import { KeyPool } from './gemini-keys.js';

interface GenerativeClientShape {
  getGenerativeModel: (args: { model: string; generationConfig?: unknown }) => {
    generateContent: (req: GenerateContentRequest) => Promise<GenerateContentResult>;
  };
}

export interface RotationOptions {
  modelName: string;
  generationConfig?: { temperature?: number };
  nowMs?: () => number;
  createClient?: (apiKey: string) => GenerativeClientShape;
}

export const ALL_KEYS_COOLING_DOWN_ERROR = 'All Gemini API keys are cooling down';

const QUOTA_MESSAGE_RE = /quota|rate.?limit|resource.?exhausted|429|too.?many.?requests/i;
const INVALID_KEY_RE = /api.?key|invalid.?key|unauthorized|forbidden|401|403/i;
const TIMEOUT_RE = /timeout|deadline.?exceeded|request.?timed.?out|408|504/i;
const NETWORK_RE = /network|eai_again|getaddrinfo|enotfound|connect.?etimedout|econnrefused|econnreset|fetch.?failed/i;

export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: unknown; message?: unknown };
  if (anyErr.status === 429) return true;
  if (typeof anyErr.message === 'string' && QUOTA_MESSAGE_RE.test(anyErr.message)) return true;
  return false;
}

export function isInvalidKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: unknown; message?: unknown };
  if (anyErr.status === 401 || anyErr.status === 403) return true;
  if (typeof anyErr.message === 'string' && INVALID_KEY_RE.test(anyErr.message)) return true;
  return false;
}

export function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: unknown; message?: unknown };
  if (anyErr.status === 408 || anyErr.status === 504) return true;
  if (typeof anyErr.message === 'string' && TIMEOUT_RE.test(anyErr.message)) return true;
  return false;
}

export function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { message?: unknown; code?: unknown; cause?: unknown };
  if (typeof anyErr.message === 'string' && NETWORK_RE.test(anyErr.message)) return true;
  if (typeof anyErr.code === 'string' && NETWORK_RE.test(anyErr.code)) return true;
  if (anyErr.cause && isNetworkError(anyErr.cause)) return true;
  return false;
}

export async function generateContentWithKeyRotation(
  pool: KeyPool,
  request: GenerateContentRequest,
  opts: RotationOptions,
): Promise<GenerateContentResult> {
  const now = opts.nowMs ?? Date.now;
  const makeClient =
    opts.createClient ?? ((apiKey: string) => new GoogleGenerativeAI(apiKey) as unknown as GenerativeClientShape);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < pool.size; attempt++) {
    const key = pool.getCurrent(now());
    if (key === null) break;
    const client = makeClient(key);
    const model = client.getGenerativeModel({
      model: opts.modelName,
      generationConfig: opts.generationConfig,
    });
    try {
      return await model.generateContent(request);
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      console.warn(`[gemini] quota on key ${pool.fingerprint(key)}, rotating`);
      pool.markExhausted(key, now());
      lastError = err;
    }
  }
  throw lastError
    ? new Error(ALL_KEYS_COOLING_DOWN_ERROR, { cause: lastError })
    : new Error(ALL_KEYS_COOLING_DOWN_ERROR);
}
