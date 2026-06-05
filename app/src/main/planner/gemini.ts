import { GoogleGenerativeAI, SchemaType, FunctionDeclaration } from '@google/generative-ai';

let cachedClient: { apiKey: string; client: GoogleGenerativeAI } | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  if (!cachedClient || cachedClient.apiKey !== apiKey) {
    cachedClient = { apiKey, client: new GoogleGenerativeAI(apiKey) };
  }
  return cachedClient.client;
}

/**
 * Function declaration for the decomposeGoal tool.
 */
export const decomposeGoalDeclaration: FunctionDeclaration = {
  name: 'decomposeGoal',
  description:
    'Decompose a high-level goal into a structured goal and a list of subtasks in logical/dependency order.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      goal: {
        type: SchemaType.OBJECT,
        description: 'Metadata about the overall goal',
        properties: {
          title: {
            type: SchemaType.STRING,
            description: 'A concise, action-oriented title for the goal',
          },
          description: {
            type: SchemaType.STRING,
            description: 'A detailed description of what the goal entails',
          },
          deadline: {
            type: SchemaType.STRING,
            description:
              'An optional ISO8601 deadline date string (e.g. 2026-06-01T23:59:59Z) if mentioned or inferred from the goal. Omit if not specified.',
          },
        },
        required: ['title', 'description'],
      },
      subtasks: {
        type: SchemaType.ARRAY,
        description:
          'An ordered list of subtasks to complete the goal. These MUST be returned in logical dependency order (first tasks in the list must be done before later tasks).',
        items: {
          type: SchemaType.OBJECT,
          properties: {
            title: {
              type: SchemaType.STRING,
              description: 'A clear, descriptive title of the specific subtask',
            },
            estimate_minutes: {
              type: SchemaType.INTEGER,
              description:
                'Estimated duration in minutes. Must be between 15 and 240 (4 hours). Break down any subtask longer than 4 hours, and merge any subtask shorter than 15 minutes.',
            },
            depends_on: {
              type: SchemaType.ARRAY,
              description:
                'Array of stringified 0-based indices of the subtasks this subtask directly depends on (e.g. ["0"] if it depends on the first subtask). Dependencies must only refer to earlier subtasks in the list.',
              items: {
                type: SchemaType.STRING,
              },
            },
          },
          required: ['title', 'estimate_minutes'],
        },
      },
    },
    required: ['goal', 'subtasks'],
  },
};

/**
 * Configure the model for planning/decomposition.
 * Uses gemini-2.0-flash as the default planning model.
 */
export function getPlannerModel(client: GoogleGenerativeAI) {
  const modelName = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  return client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
    },
  });
}

export interface ModelCandidate {
  name: string;
  getModel: () => ReturnType<typeof getPlannerModel>;
}

/**
 * Returns the list of available model candidate helpers in fallback order.
 */
export function getPlannerCandidates(client: GoogleGenerativeAI): ModelCandidate[] {
  const defaultModelName = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  const fallbackNames = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite-preview-02-05',
    'gemini-1.5-pro',
  ].filter((m) => m !== defaultModelName);
  return [
    { name: defaultModelName, getModel: () => getPlannerModel(client) },
    ...fallbackNames.map((name) => ({
      name,
      getModel: () =>
        client.getGenerativeModel({
          model: name,
          generationConfig: {
            temperature: 0.1,
          },
        }),
    })),
  ];
}
