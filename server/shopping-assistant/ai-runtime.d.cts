type Options = Pick<Parameters<typeof import('ai').generateText>[0], 'model' | 'maxOutputTokens' | 'reasoning' | 'maxRetries' | 'timeout' | 'system' | 'messages'>;
export function generateIntent(options: Options, schema: unknown): Promise<unknown>;

export function hasCreditBalance(minimum: number): Promise<boolean>;
