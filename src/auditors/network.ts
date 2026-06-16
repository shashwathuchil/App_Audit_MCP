import { chromium, Browser } from '@playwright/test';
import { NetworkIssue } from '../types/index.js';
import logger from '../utils/logger.js';
import { withRetry, withTimeout } from '../utils/retry.js';

export class NetworkCollector {
  private browser: Browser | null = null;

  async collect(
    url: string,
    _route?: string,
    slowThreshold: number = 1000,
    _maxSize: number = 1048576
  ): Promise<NetworkIssue[]> {
    logger.info(`Collecting network issues for ${url}`);

    const issues: NetworkIssue[] = [];
    const requestStartTimes = new Map<string, number>();

    try {
      this.browser = await chromium.launch({ headless: true });
      const context = await this.browser.newContext();
      const page = await context.newPage();

      page.on('request', (request) => {
        requestStartTimes.set(request.url(), Date.now());
      });

      page.on('response', async (response) => {
        const status = response.status();
        const request = response.request();
        const startTime = requestStartTimes.get(request.url()) || Date.now();
        const duration = Date.now() - startTime;

        let type: NetworkIssue['type'] | null = null;

        if (status >= 400 && status < 500) {
          type = '4xx';
        } else if (status >= 500) {
          type = '5xx';
        } else if (!response.ok()) {
          type = 'failed';
        } else if (duration > slowThreshold) {
          type = 'slow';
        }

        if (type) {
          const headers: Record<string, string> = {};
          const responseHeaders = response.headers();
          for (const key in responseHeaders) {
            headers[key] = responseHeaders[key];
          }

          const issue: NetworkIssue = {
            url: request.url(),
            status,
            method: request.method(),
            type,
            duration: type === 'slow' ? duration : undefined,
            size: type === 'slow' ? await this.getResponseSize(response) : undefined,
            timestamp: new Date(),
            headers,
          };
          issues.push(issue);
        }
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

      await page.waitForTimeout(2000);

      await context.close();
      await this.browser.close();

      logger.info(`Collected ${issues.length} network issues`);
      return issues;
    } catch (error) {
      logger.error('Failed to collect network issues:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  private async getResponseSize(response: any): Promise<number> {
    try {
      const buffer = await response.body();
      return buffer.length;
    } catch {
      return 0;
    }
  }
}
