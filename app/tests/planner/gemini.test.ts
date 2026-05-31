import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getGeminiClient,
  getPlannerModel,
  decomposeGoalDeclaration,
} from '../../src/main/planner/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn(function (
      this: { apiKey: string; getGenerativeModel: ReturnType<typeof vi.fn> },
      apiKey: string,
    ) {
      this.apiKey = apiKey;
      this.getGenerativeModel = vi.fn();
    }),
    SchemaType: {
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      STRING: 'STRING',
      INTEGER: 'INTEGER',
      NUMBER: 'NUMBER',
      BOOLEAN: 'BOOLEAN',
    },
  };
});

describe('gemini configuration and client', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
  });

  it('throws an error when GEMINI_API_KEY is not set', () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => getGeminiClient()).toThrow('GEMINI_API_KEY environment variable is not set');
  });

  it('instantiates GoogleGenerativeAI client when GEMINI_API_KEY is set', () => {
    process.env.GEMINI_API_KEY = 'mock-api-key';
    const client = getGeminiClient();
    expect(GoogleGenerativeAI).toHaveBeenCalledWith('mock-api-key');
    expect(client).toBeDefined();
  });

  it('configures and returns the planning model', () => {
    const mockGetGenerativeModel = vi.fn().mockReturnValue({ modelName: 'mocked-model' });
    const mockClient = {
      getGenerativeModel: mockGetGenerativeModel,
    } as unknown as GoogleGenerativeAI;

    const model = getPlannerModel(mockClient);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1,
      },
    });
    expect(model).toEqual({ modelName: 'mocked-model' });
  });

  it('defines the decomposeGoalDeclaration schema correctly', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decl = decomposeGoalDeclaration as any;
    expect(decl.name).toBe('decomposeGoal');
    expect(decl.parameters.type).toBe('OBJECT');
    expect(decl.parameters.properties.goal.required).toContain('title');
    expect(decl.parameters.properties.subtasks.type).toBe('ARRAY');
  });
});
