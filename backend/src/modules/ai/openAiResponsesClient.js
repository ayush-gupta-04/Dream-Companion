export class AiUnavailableError extends Error {
  constructor(message = 'AI features are not configured.') {
    super(message);
    this.name = 'AiUnavailableError';
    this.statusCode = 503;
  }
}

function outputText(response) {
  const message = response.output?.find((item) => item.type === 'message');
  return message?.content?.find((item) => item.type === 'output_text')?.text;
}

export function createOpenAiResponsesClient(config) {
  if (!config.apiKey) return null;

  return {
    async parseStructured({ input, format, schema }) {
      let response;
      try {
        response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: config.model,
            store: false,
            max_output_tokens: config.maxOutputTokens,
            input,
            text: { format }
          }),
          signal: AbortSignal.timeout(config.timeoutMs)
        });
      } catch {
        throw new AiUnavailableError('The AI provider could not be reached.');
      }

      if (!response.ok) {
        throw new AiUnavailableError('The AI provider could not complete this request.');
      }

      try {
        const text = outputText(await response.json());
        if (!text) throw new Error('Missing output text.');
        return schema.parse(JSON.parse(text));
      } catch {
        throw new AiUnavailableError('The AI response could not be validated.');
      }
    }
  };
}
