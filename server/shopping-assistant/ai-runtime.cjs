// Keep native import() in JavaScript: Vercel's CommonJS TypeScript compiler rewrites
// dynamic imports to require(), but the AI SDK is ESM-only in this runtime.
exports.generateIntent = async function generateIntent(options, schema) {
  const { generateText, Output } = await import('ai');
  const result = await generateText({ ...options, output: Output.object({ schema }) });
  return result.output;
};

exports.hasCreditBalance = async function hasCreditBalance(minimum) {
  const { createGateway } = await import('ai');
  const gateway = createGateway({ fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) });
  const credits = await gateway.getCredits();
  const balance = Number(credits.balance);
  return Number.isFinite(balance) && balance >= minimum;
};
