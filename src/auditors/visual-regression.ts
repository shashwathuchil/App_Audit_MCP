import { chromium, Browser } from '@playwright/test';
import { Screenshot } from '../types/index.js';
import logger from '../utils/logger.js';
import { withRetry, withTimeout } from '../utils/retry.js';
import { saveScreenshot } from '../utils/storage.js';

export class VisualRegressionAuditor {
  private browser: Browser | null = null;

  async capture(
    url: string,
    route?: string,
    viewports: Array<{ width: number; height: number }> = [
      { width: 375, height: 667 },
      { width: 1920, height: 1080 },
    ]
  ): Promise<Screenshot[]> {
    logger.info(`Capturing screenshots for ${url} across ${viewports.length} viewports`);

    const screenshots: Screenshot[] = [];

    try {
      this.browser = await chromium.launch({ headless: true });

      for (const viewport of viewports) {
        const viewportString = `${viewport.width}x${viewport.height}`;
        logger.info(`Capturing viewport ${viewportString}`);

        const context = await this.browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();

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

        await page.waitForTimeout(1000);

        const screenshot = await page.screenshot({ fullPage: true });
        const filename = `screenshot-${viewport.width}x${viewport.height}-${Date.now()}.png`;
        const path = await saveScreenshot(screenshot, filename);

        screenshots.push({
          url: route || url,
          path,
          viewport: viewportString,
          timestamp: new Date(),
        });

        await context.close();
      }

      await this.browser.close();

      logger.info(`Captured ${screenshots.length} screenshots`);
      return screenshots;
    } catch (error) {
      logger.error('Failed to capture screenshots:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  async detectRenderingIssues(url: string, _route?: string): Promise<string[]> {
    logger.info(`Detecting rendering issues for ${url}`);

    const issues: string[] = [];

    try {
      this.browser = await chromium.launch({ headless: true });
      const context = await this.browser.newContext();
      const page = await context.newPage();

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

      const brokenImages = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        const broken: string[] = [];

        for (const img of images) {
          if (!img.complete || img.naturalWidth === 0) {
            broken.push(img.src || 'unknown');
          }
        }
        return broken;
      });

      for (const src of brokenImages) {
        issues.push(`Broken image detected: ${src}`);
      }

      const blankScreen = await page.evaluate(() => {
        const body = document.body;
        const text = body.innerText?.trim() || '';
        const images = body.querySelectorAll('img').length;
        return text.length === 0 && images === 0;
      });

      if (blankScreen) {
        issues.push('Blank screen detected - no content rendered');
      }

      await context.close();
      await this.browser.close();

      logger.info(`Found ${issues.length} rendering issues`);
      return issues;
    } catch (error) {
      logger.error('Failed to detect rendering issues:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }
}
