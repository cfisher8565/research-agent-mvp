/**
 * Timeout utility for async generators
 * Wraps any async iterable with timeout protection
 */

/**
 * Wraps an async generator with timeout protection
 * 
 * @param asyncIterator - The async iterator to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param onTimeout - Optional callback when timeout occurs
 * @returns Async generator that yields items or throws timeout error
 */
export async function* withTimeout<T>(
  asyncIterator: AsyncIterableIterator<T>,
  timeoutMs: number,
  onTimeout?: () => void
): AsyncGenerator<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  const createTimeout = () => new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (onTimeout) onTimeout();
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    let timeoutPromise = createTimeout();

    for await (const item of asyncIterator) {
      // Clear old timeout before yielding
      if (timeoutId) clearTimeout(timeoutId);

      // Yield the item (race between item and timeout)
      yield await Promise.race([
        Promise.resolve(item),
        timeoutPromise
      ]) as T;

      // Reset timeout for next iteration
      timeoutPromise = createTimeout();
    }
  } finally {
    // Always clean up timeout
    if (timeoutId) clearTimeout(timeoutId);

    // Clean up iterator if possible
    if (typeof asyncIterator.return === 'function') {
      try {
        await asyncIterator.return();
      } catch (err) {
        console.error('[Timeout] Failed to clean up async iterator:', err);
      }
    }
  }
}
