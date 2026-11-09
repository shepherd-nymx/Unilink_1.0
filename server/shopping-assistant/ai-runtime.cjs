// Keep native import() in JavaScript: Vercel's CommonJS TypeScript compiler rewrites
// dynamic imports to require(), but the AI SDK is ESM-only in this runtime.
exports.generateIntent = async function generateIntent(options, schema) {
  const { generateText, Output } = await import('ai');
  const result = await generateText({ ...options, output: Output.object({ schema }) });
  return result.output;
};
