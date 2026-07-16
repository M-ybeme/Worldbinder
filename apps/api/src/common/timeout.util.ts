/** Rejects after `ms` milliseconds — race this against a check that could
 * otherwise hang on a dependency's own (much longer) retry/timeout
 * defaults, e.g. `Promise.race([check(), rejectAfter(2000, '...')])`. */
export function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}
