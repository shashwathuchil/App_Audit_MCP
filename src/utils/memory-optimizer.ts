import logger from './logger.js';

export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private memoryThreshold: number = 0.8; // 80% of max memory
  private gcInterval: NodeJS.Timeout | null = null;
  private monitoringEnabled: boolean = false;

  private constructor() {}

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringEnabled) {
      logger.warn('Memory monitoring already enabled');
      return;
    }

    this.monitoringEnabled = true;
    this.gcInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);

    logger.info(`Memory monitoring started (interval: ${intervalMs}ms)`);
  }

  stopMonitoring(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
    this.monitoringEnabled = false;
    logger.info('Memory monitoring stopped');
  }

  private checkMemoryUsage(): void {
    const usage = this.getMemoryUsage();
    const maxMemory = process.memoryUsage().heapTotal;
    const usagePercent = usage.heapUsed / maxMemory;

    if (usagePercent > this.memoryThreshold) {
      logger.warn(`Memory usage high: ${(usagePercent * 100).toFixed(2)}%`, {
        used: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        total: `${(maxMemory / 1024 / 1024).toFixed(2)}MB`,
      });
      this.forceGarbageCollection();
    }
  }

  getMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  } {
    return process.memoryUsage();
  }

  forceGarbageCollection(): void {
    if (global.gc) {
      logger.debug('Forcing garbage collection');
      global.gc();
    } else {
      logger.warn('Garbage collection not available (run with --expose-gc)');
    }
  }

  setMemoryThreshold(threshold: number): void {
    this.memoryThreshold = Math.max(0.5, Math.min(0.95, threshold));
    logger.debug(`Memory threshold set to ${(this.memoryThreshold * 100).toFixed(0)}%`);
  }

  optimizeArrays<T>(array: T[], maxSize: number = 1000): T[] {
    if (array.length <= maxSize) {
      return array;
    }

    logger.debug(`Optimizing array from ${array.length} to ${maxSize} elements`);
    return array.slice(0, maxSize);
  }

  clearObjectCache<T>(cache: Map<string, T>, keepRecent: number = 100): void {
    if (cache.size <= keepRecent) {
      return;
    }

    const entries = Array.from(cache.entries());
    const toKeep = entries.slice(-keepRecent);
    
    cache.clear();
    for (const [key, value] of toKeep) {
      cache.set(key, value);
    }

    logger.debug(`Cleared cache, kept ${toKeep.length} of ${entries.length} entries`);
  }

  streamProcessArray<T, R>(
    array: T[],
    processor: (item: T, index: number) => R,
    chunkSize: number = 100
  ): R[] {
    const results: R[] = [];
    
    for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      
      for (let j = 0; j < chunk.length; j++) {
        results.push(processor(chunk[j], i + j));
      }

      // Force GC after each chunk to prevent memory buildup
      if (i > 0 && i % (chunkSize * 5) === 0) {
        this.forceGarbageCollection();
      }
    }

    return results;
  }

  async streamProcessArrayAsync<T, R>(
    array: T[],
    processor: (item: T, index: number) => Promise<R>,
    chunkSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      
      for (let j = 0; j < chunk.length; j++) {
        results.push(await processor(chunk[j], i + j));
      }

      // Force GC after each chunk to prevent memory buildup
      if (i > 0 && i % (chunkSize * 5) === 0) {
        this.forceGarbageCollection();
      }
    }

    return results;
  }

  getMemoryStats(): {
    heapUsedMB: number;
    heapTotalMB: number;
    usagePercent: number;
    externalMB: number;
    arrayBuffersMB: number;
  } {
    const usage = this.getMemoryUsage();
    
    return {
      heapUsedMB: usage.heapUsed / 1024 / 1024,
      heapTotalMB: usage.heapTotal / 1024 / 1024,
      usagePercent: (usage.heapUsed / usage.heapTotal) * 100,
      externalMB: usage.external / 1024 / 1024,
      arrayBuffersMB: usage.arrayBuffers / 1024 / 1024,
    };
  }

  shouldReduceLoad(): boolean {
    const stats = this.getMemoryStats();
    return stats.usagePercent > this.memoryThreshold;
  }

  getRecommendedChunkSize(defaultSize: number): number {
    const stats = this.getMemoryStats();
    
    if (stats.usagePercent > 0.9) {
      return Math.max(10, Math.floor(defaultSize * 0.25));
    }
    if (stats.usagePercent > 0.8) {
      return Math.max(25, Math.floor(defaultSize * 0.5));
    }
    if (stats.usagePercent > 0.7) {
      return Math.max(50, Math.floor(defaultSize * 0.75));
    }
    
    return defaultSize;
  }
}

export const memoryOptimizer = MemoryOptimizer.getInstance();
