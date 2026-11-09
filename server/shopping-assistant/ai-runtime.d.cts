type Options = Pick<Parameters<typeof import('ai').generateText>[0], 'model' | 'maxOutputTokens' | 'reasoning' | 'maxRetries' | 'timeout' | 'system' | 'messages'>;
export function generateIntent(options: Options, schema: unknown): Promise<unknown>;
