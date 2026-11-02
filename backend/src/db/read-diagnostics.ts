import { AsyncLocalStorage } from 'node:async_hooks';

type DataSource = 'postgresql' | 'memory';
const diagnostics = new AsyncLocalStorage<Set<DataSource>>();

export function recordReadSource(source: DataSource) { diagnostics.getStore()?.add(source); }

/** Each request tracks actual reads, including query failures that fell back to RAM. */
export async function withReadDiagnostics<T>(read: () => Promise<T>) {
  const sources = new Set<DataSource>();
  const value = await diagnostics.run(sources, read);
  const source = sources.size > 1 ? 'mixed' : sources.has('postgresql') ? 'postgresql' : 'memory';
  return { value, source: source as 'postgresql' | 'memory' | 'mixed' };
}
