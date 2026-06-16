import { chromium, Browser, BrowserContext } from '@playwright/test';
import logger from './logger.js';

export class BrowserPool {
  private static instance: BrowserPool;
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private maxContexts: number = 5;
  private contextCount: number = 0;

  private constructor() {}

  static getInstance(): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool();
    }
    return BrowserPool.instance;
  }

  async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      logger.info('Launching new browser instance');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  async getContext(id: string = 'default'): Promise<BrowserContext> {
    if (this.contexts.has(id)) {
      const context = this.contexts.get(id)!;
      if (context.pages().length > 0) {
        return context;
      }
    }

    if (this.contextCount >= this.maxContexts) {
      await this.cleanupOldestContext();
    }

    const browser = await this.getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });

    this.contexts.set(id, context);
    this.contextCount++;
    logger.debug(`Created context ${id}, total contexts: ${this.contextCount}`);

    return context;
  }

  async releaseContext(id: string): Promise<void> {
    const context = this.contexts.get(id);
    if (context) {
      await context.close();
      this.contexts.delete(id);
      this.contextCount--;
      logger.debug(`Released context ${id}, remaining contexts: ${this.contextCount}`);
    }
  }

  private async cleanupOldestContext(): Promise<void> {
    const [oldestId] = this.contexts.keys();
    if (oldestId) {
      logger.debug(`Cleaning up oldest context: ${oldestId}`);
      await this.releaseContext(oldestId);
    }
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up browser pool');
    
    for (const [id, context] of this.contexts) {
      try {
        await context.close();
      } catch (error) {
        logger.warn(`Failed to close context ${id}:`, error);
      }
    }
    this.contexts.clear();
    this.contextCount = 0;

    if (this.browser && this.browser.isConnected()) {
      try {
        await this.browser.close();
      } catch (error) {
        logger.warn('Failed to close browser:', error);
      }
    }
    this.browser = null;

    logger.info('Browser pool cleanup complete');
  }

  setMaxContexts(max: number): void {
    this.maxContexts = Math.max(1, max);
    logger.debug(`Max contexts set to ${this.maxContexts}`);
  }

  getStats(): { browserConnected: boolean; contextCount: number; maxContexts: number } {
    return {
      browserConnected: this.browser?.isConnected() || false,
      contextCount: this.contextCount,
      maxContexts: this.maxContexts,
    };
  }
}
