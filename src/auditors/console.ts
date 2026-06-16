import { chromium, Browser } from '@playwright/test';
import { ConsoleLog } from '../types/index.js';
import logger from '../utils/logger.js';
import { withRetry, withTimeout } from '../utils/retry.js';

export class ConsoleCollector {
  private browser: Browser | null = null;

  async collect(url: string, route?: string): Promise<ConsoleLog[]> {
    logger.info(`Collecting console logs for ${url}`);

    const logs: ConsoleLog[] = [];

    try {
      this.browser = await chromium.launch({ headless: true });
      const context = await this.browser.newContext();
      const page = await context.newPage();

      page.on('console', (msg) => {
        const log: ConsoleLog = {
          level: this.getLogLevel(msg.type()),
          message: msg.text(),
          url: route || url,
          timestamp: new Date(),
          stack: msg.location()?.url,
        };
        logs.push(log);
      });

      page.on('pageerror', (error) => {
        const log: ConsoleLog = {
          level: 'error',
          message: error.message,
          url: route || url,
          timestamp: new Date(),
          stack: error.stack,
        };
        logs.push(log);
      });

      await withRetry(
        async () => {
          await withTimeout(
            async () => page.goto(url, { waitUntil: 'networkidle' }),
            30000,
            `Page load timeout for ${url}`
          );
        },
        { retries: 3 }
      );

      await page.waitForTimeout(3000);

      await context.close();
      await this.browser.close();

      logger.info(`Collected ${logs.length} console logs`);
      return logs;
    } catch (error) {
      logger.error('Failed to collect console logs:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  private getLogLevel(type: string): ConsoleLog['level'] {
    switch (type) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warn';
      case 'info':
        return 'info';
      case 'debug':
      case 'log':
      default:
        return 'debug';
    }
  }
}
