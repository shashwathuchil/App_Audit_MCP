import pRetry from 'p-retry';
import logger from './logger.js';

export interface RetryOptions {
  retries?: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
  onFailedAttempt?: (error: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    factor = 2,
    minTimeout = 1000,
    maxTimeout = 10000,
    onFailedAttempt,
  } = options;

  return pRetry(fn, {
    retries,
    factor,
    minTimeout,
    maxTimeout,
    onFailedAttempt: (error) => {
      logger.warn(`Retry attempt ${error.attemptNumber} failed`, {
        message: error.message,
        retriesLeft: error.retriesLeft,
      });
      if (onFailedAttempt) {
        onFailedAttempt(error);
      }
    },
  });
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}
