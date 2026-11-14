export class AiUnavailableError extends Error {
  constructor(message = 'AI features are not configured.') {
    super(message);
    this.name = 'AiUnavailableError';
    this.statusCode = 503;
  }
}

function outputText(response) {
  return response.candidates?.[0]?.content?.parts?.[0]?.text;
}

function providerErrorStatus(errorBody) {
  try {
    return JSON.parse(errorBody)?.error?.status;
  } catch {
    return null;
  }
}

export function createGeminiClient(config) {
  if (!config?.apiKey) return null;

  return {
    async generateStructured({ systemInstruction, prompt, schema, responseSchema }) {
      let response;
      const model = encodeURIComponent(config.model || 'gemini-3.5-flash');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const generationConfig = {
        responseMimeType: 'application/json',
        ...(responseSchema ? { responseSchema } : {}),
        ...(config.maxOutputTokens ? { maxOutputTokens: config.maxOutputTokens } : {}),
        ...(config.thinkingLevel ? { thinkingConfig: { thinkingLevel: config.thinkingLevel } } : {})
      };

      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'x-goog-api-key': config.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...(systemInstruction
              ? {
                  systemInstruction: {
                    parts: [{ text: systemInstruction }]
                  }
                }
              : {}),
            contents: [
              {
                role: 'user',
                parts: [{ text: typeof prompt === 'string' ? prompt : JSON.stringify(prompt) }]
              }
            ],
            generationConfig
          }),
          signal: AbortSignal.timeout(config.timeoutMs || 30000)
        });
      } catch (err) {
        if (err.name === 'TimeoutError') {
          console.error(
            `[Gemini Timeout Error]: Request timed out after ${config.timeoutMs || 30000}ms.`
          );
          throw new AiUnavailableError('The AI provider request timed out.');
        }
        console.error('[Gemini Network Error]:', err.message, err.cause || '');
        throw new AiUnavailableError('The AI provider could not be reached.');
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const status = providerErrorStatus(errorBody);
        console.error(`[Gemini API Error] HTTP ${response.status}:`, errorBody);
        throw new AiUnavailableError(
          `The AI provider rejected this request${status ? ` (${status})` : ''}.`
        );
      }

      let rawJson;
      try {
        rawJson = await response.json();
      } catch (err) {
        console.error(
          '[Gemini JSON Parse Error]: Failed to parse API response as JSON:',
          err.message
        );
        throw new AiUnavailableError('The AI provider returned an unparseable response.');
      }

      const text = outputText(rawJson);
      if (!text) {
        const finishReason = rawJson?.candidates?.[0]?.finishReason;
        console.error(
          '[Gemini Empty Output]: Missing text in candidate. Finish reason:',
          finishReason
        );
        throw new AiUnavailableError('The AI provider returned an empty response.');
      }

      try {
        const parsed = JSON.parse(text);
        return schema.parse(parsed);
      } catch (err) {
        console.error('[Gemini Schema Validation Error]:', err.message, 'Output text was:', text);
        throw new AiUnavailableError('The AI response could not be validated.');
      }
    }
  };
}
