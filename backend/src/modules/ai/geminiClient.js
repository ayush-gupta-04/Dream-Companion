import { GoogleGenAI } from '@google/genai';
import { config } from '../../config/index.js';

/**
 * Error thrown when AI is unconfigured, unreachable, or returns invalid data.
 * Carries an HTTP status code for Express error handlers.
 */
export class AiUnavailableError extends Error {
  constructor(message = 'AI features are not configured.', statusCode = 503) {
    super(message);
    this.name = 'AiUnavailableError';
    this.statusCode = statusCode;
  }
}

// Cached client instance to avoid recreating SDK on every request
let cachedClient = null;
let cachedKey = null;
let cachedTimeout = null;

function getClient() {
  const gemini = config.gemini;
  if (!gemini.apiKey) throw new AiUnavailableError();

  const timeoutMs = gemini.timeoutMs || 30000;
  if (!cachedClient || cachedKey !== gemini.apiKey || cachedTimeout !== timeoutMs) {
    cachedClient = new GoogleGenAI({
      apiKey: gemini.apiKey,
      apiVersion: 'v1beta',
      httpOptions: { timeout: timeoutMs }
    });
    cachedKey = gemini.apiKey;
    cachedTimeout = timeoutMs;
  }
  return cachedClient;
}

function requireOutputText(response) {
  const text = response?.text?.trim();
  if (text) return text;
  throw new AiUnavailableError('The AI provider returned an empty response.', 502);
}

async function requestGemini({
  systemInstruction,
  prompt,
  generationConfig = {},
  tools,
  toolConfig
}) {
  const gemini = config.gemini;
  const ai = getClient();
  const model = gemini.model || 'gemini-3.5-flash';
  const contents = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

  try {
    return await ai.models.generateContent({
      model,
      contents,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(tools ? { tools } : {}),
        ...(toolConfig ? { toolConfig } : {}),
        ...(gemini.maxOutputTokens ? { maxOutputTokens: gemini.maxOutputTokens } : {}),
        ...(gemini.thinkingLevel ? { thinkingConfig: { thinkingLevel: gemini.thinkingLevel } } : {}),
        ...generationConfig
      }
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError(err.message, err.status || 503);
  }
}

/**
 * Generates free-form text response (used for match analysis and recaps).
 */
export async function generateText({ systemInstruction, prompt }) {
  const response = await requestGemini({ systemInstruction, prompt });
  return requireOutputText(response);
}

/**
 * Executes a function-calling request to extract structured tool intent and arguments.
 */
export async function generateFunctionCall({ systemInstruction, prompt, tools, toolConfig }) {
  const response = await requestGemini({
    systemInstruction,
    prompt,
    tools,
    toolConfig
  });

  const call = response.functionCalls?.[0];
  return {
    name: call?.name || 'UNSUPPORTED',
    args: call?.args || {}
  };
}
