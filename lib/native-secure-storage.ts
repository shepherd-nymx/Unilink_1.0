import * as SecureStore from 'expo-secure-store';

type Manifest = { chunked: 1; generation: string; parts: number };
const queue = new Map<string, Promise<unknown>>();
const keyFor = (key: string) => `unilink.secure.${key.replace(/[^\w.-]/g, '_')}`;
const partKey = (key: string, manifest: Manifest, index: number) => `${key}.${manifest.generation}.${index}`;

function manifest(value: string | null): Manifest | null {
 if (!value) return null;
 try { const data = JSON.parse(value); return data.chunked === 1 && typeof data.generation === 'string' && Number.isInteger(data.parts) && data.parts > 0 && data.parts <= 512 ? data : null; } catch { return null; }
}
async function serial<T>(key: string, operation: () => Promise<T>): Promise<T> {
 const previous = queue.get(key) || Promise.resolve();
 const current = previous.catch(() => undefined).then(operation);
 queue.set(key, current);
 try { return await current; } finally { if (queue.get(key) === current) queue.delete(key); }
}
async function clean(key: string, old: Manifest | null) {
 if (old) await Promise.all(Array.from({ length: old.parts }, (_, i) => SecureStore.deleteItemAsync(partKey(key, old, i)).catch(() => undefined)));
}

// Chunk large Supabase sessions so SecureStore's per-value platform limits are
// respected. Write the manifest last, preserving the previous value on failure.
export const nativeSecureStorage = {
 getItem(key: string): Promise<string | null> {
  const base = keyFor(key);
  return serial(base, async () => {
   const raw = await SecureStore.getItemAsync(base), index = manifest(raw);
   if (!index) return raw;
   const parts = await Promise.all(Array.from({ length: index.parts }, (_, i) => SecureStore.getItemAsync(partKey(base, index, i))));
   return parts.some(part => part == null) ? null : parts.join('');
  });
 },
 setItem(key: string, value: string): Promise<void> {
  const base = keyFor(key);
  return serial(base, async () => {
   const old = manifest(await SecureStore.getItemAsync(base));
   const chars = Array.from(value), parts: string[] = [];
   for (let offset = 0; offset < chars.length; offset += 480) parts.push(chars.slice(offset, offset + 480).join(''));
   if (!parts.length) parts.push('');
   if (parts.length > 512) throw new Error('Session is too large to save securely.');
   const index: Manifest = { chunked: 1, generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, parts: parts.length };
   try {
    const writes = await Promise.allSettled(parts.map((part, i) => SecureStore.setItemAsync(partKey(base, index, i), part)));
    const failed = writes.find(write => write.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    await SecureStore.setItemAsync(base, JSON.stringify(index));
   } catch (error) { await clean(base, index); throw error; }
   await clean(base, old);
  });
 },
 removeItem(key: string): Promise<void> {
  const base = keyFor(key);
  return serial(base, async () => {
   const old = manifest(await SecureStore.getItemAsync(base));
   await SecureStore.deleteItemAsync(base);
   await clean(base, old);
  });
 },
};
