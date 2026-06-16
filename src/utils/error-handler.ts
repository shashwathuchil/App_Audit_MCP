import logger from './logger.js';

export interface ErrorContext {
  operation: string;
  url?: string;
  attempt: number;
  maxAttempts: number;
  timestamp: Date;
}

export class ErrorHandler {
  private errorLog: Map<string, { count: number; lastError: Error; lastSeen: Date }> = new Map();
  private maxErrorCount: number = 5;
  private errorCooldown: number = 60000; // 1 minute

  handleError(error: Error, context: ErrorContext, recovery?: () => Promise<any>): any {
    const errorKey = `${context.operation}:${context.url || 'global'}`;
    const errorEntry = this.errorLog.get(errorKey);

    if (errorEntry) {
      const timeSinceLastError = Date.now() - errorEntry.lastSeen.getTime();
      
      if (timeSinceLastError < this.errorCooldown && errorEntry.count >= this.maxErrorCount) {
        logger.error(`Error cooldown active for ${errorKey}, skipping retry`);
        throw new Error(`Too many errors for ${context.operation}. Cooling down.`);
      }

      errorEntry.count++;
      errorEntry.lastError = error;
      errorEntry.lastSeen = new Date();
    } else {
      this.errorLog.set(errorKey, {
        count: 1,
        lastError: error,
        lastSeen: new Date(),
      });
    }

    logger.error(`Error in ${context.operation} (attempt ${context.attempt}/${context.maxAttempts}):`, {
      message: error.message,
      stack: error.stack,
      context,
    });

    if (recovery && context.attempt < context.maxAttempts) {
      logger.info(`Attempting recovery for ${context.operation}`);
      return recovery();
    }

    throw error;
  }

  isRecoverable(error: Error): boolean {
    const recoverablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /econnrefused/i,
      /etimedout/i,
      /temporary/i,
      /rate limit/i,
    ];

    return recoverablePatterns.some((pattern) => pattern.test(error.message));
  }

  shouldRetry(error: Error, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) {
      return false;
    }

    if (!this.isRecoverable(error)) {
      logger.warn('Error is not recoverable, not retrying');
      return false;
    }

    return true;
  }

  getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, attempt), 16000);
  }

  clearErrorLog(): void {
    this.errorLog.clear();
    logger.debug('Error log cleared');
  }

  getErrorStats(): { totalErrors: number; errorsByOperation: Record<string, number> } {
    const errorsByOperation: Record<string, number> = {};
    let totalErrors = 0;

    for (const [key, entry] of this.errorLog) {
      const operation = key.split(':')[0];
      errorsByOperation[operation] = (errorsByOperation[operation] || 0) + entry.count;
      totalErrors += entry.count;
    }

    return { totalErrors, errorsByOperation };
  }

  setErrorCooldown(cooldown: number): void {
    this.errorCooldown = cooldown;
    logger.debug(`Error cooldown set to ${cooldown}ms`);
  }

  setMaxErrorCount(max: number): void {
    this.maxErrorCount = max;
    logger.debug(`Max error count set to ${max}`);
  }
}

export const errorHandler = new ErrorHandler();
