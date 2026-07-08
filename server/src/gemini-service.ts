import { GoogleGenerativeAI, FunctionCallingMode, FunctionCall, Part, FunctionDeclaration } from '@google/generative-ai';

const FALLBACK_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

export async function executeGeminiWithFallback(
  apiKey: string,
  prompt: string,
  functionDeclaration: FunctionDeclaration,
  functionName: string,
  temperature = 0.1
) {
  const client = new GoogleGenerativeAI(apiKey);
  const defaultModelName = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  const fallbackNames = FALLBACK_MODELS.filter((m) => m !== defaultModelName);
  const candidates = [defaultModelName, ...fallbackNames];

  let response;
  let lastError: Error | null = null;

  for (const modelName of candidates) {
    try {
      console.log(`[Server] Attempting Gemini call using model: ${modelName}`);
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature,
        },
      });

      response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ functionDeclarations: [functionDeclaration] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingMode.ANY,
            allowedFunctionNames: [functionName],
          },
        },
      });
      break; // Successfully got response, break the loop
    } catch (err) {
      console.warn(`[Server] Gemini call failed using ${modelName}:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (!response) {
    throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown'}`);
  }

  // Extract the function call
  const functionCalls =
    typeof response.response.functionCalls === 'function'
      ? response.response.functionCalls()
      : undefined;
  let call: FunctionCall | undefined = functionCalls?.[0];

  if (!call) {
    const parts: Part[] = response.response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.functionCall) {
        call = part.functionCall;
        break;
      }
    }
  }

  if (!call) {
    throw new Error(`Gemini failed to call the ${functionName} function`);
  }

  if (call.name !== functionName) {
    throw new Error(`Unexpected function call from Gemini: ${call.name} (expected ${functionName})`);
  }

  return call.args;
}

export async function executeGeminiVisionWithFallback(
    apiKey: string,
    prompt: string,
    screenshotBase64: string,
    functionDeclaration: FunctionDeclaration,
    functionName: string,
    temperature = 0.1
) {
    const client = new GoogleGenerativeAI(apiKey);
    const defaultModelName = (process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash').trim();
    const candidates = [defaultModelName, ...FALLBACK_MODELS].filter((m, i, a) => a.indexOf(m) === i);

    let response;
    let lastError: Error | null = null;

    for (const modelName of candidates) {
        try {
            console.log(`[Server] Attempting Gemini Vision call using model: ${modelName}`);
            const model = client.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature,
                },
            });

            response = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
                        { text: prompt },
                    ]
                }],
                tools: [{ functionDeclarations: [functionDeclaration] }],
                toolConfig: {
                    functionCallingConfig: {
                        mode: FunctionCallingMode.ANY,
                        allowedFunctionNames: [functionName],
                    },
                },
            });
            break;
        } catch (err) {
            console.warn(`[Server] Gemini Vision call failed using ${modelName}:`, err);
            lastError = err instanceof Error ? err : new Error(String(err));
        }
    }

    if (!response) {
        throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown'}`);
    }

    const functionCalls =
        typeof response.response.functionCalls === 'function'
            ? response.response.functionCalls()
            : undefined;
    let call: FunctionCall | undefined = functionCalls?.[0];

    if (!call) {
        const parts: Part[] = response.response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.functionCall) {
                call = part.functionCall;
                break;
            }
        }
    }

    if (!call) {
        throw new Error(`Gemini failed to call the ${functionName} function`);
    }

    if (call.name !== functionName) {
        throw new Error(`Unexpected function call from Gemini: ${call.name} (expected ${functionName})`);
    }

    return call.args;
}
