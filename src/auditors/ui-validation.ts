import { chromium, Browser } from '@playwright/test';
import { UIIssue } from '../types/index.js';
import logger from '../utils/logger.js';
import { withRetry, withTimeout } from '../utils/retry.js';
import { saveScreenshot } from '../utils/storage.js';

export class UIValidator {
  private browser: Browser | null = null;

  async validate(
    url: string,
    route?: string,
    viewports: Array<{ width: number; height: number }> = [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ]
  ): Promise<UIIssue[]> {
    logger.info(`Running UI validation for ${url} across ${viewports.length} viewports`);

    const allIssues: UIIssue[] = [];

    try {
      this.browser = await chromium.launch({ headless: true });

      for (const viewport of viewports) {
        const viewportString = `${viewport.width}x${viewport.height}`;
        logger.info(`Validating viewport ${viewportString}`);

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

        const issues = await this.detectUIIssues(page, url, viewportString, route);
        allIssues.push(...issues);

        if (issues.length > 0) {
          const screenshot = await page.screenshot({ fullPage: true });
          const filename = `ui-issue-${viewport.width}x${viewport.height}-${Date.now()}.png`;
          const path = await saveScreenshot(screenshot, filename);
          
          for (const issue of issues) {
            issue.screenshot = path;
          }
        }

        await context.close();
      }

      await this.browser.close();

      logger.info(`Found ${allIssues.length} UI issues`);
      return allIssues;
    } catch (error) {
      logger.error('Failed to run UI validation:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  private async detectUIIssues(
    page: any,
    url: string,
    viewport: string,
    route?: string
  ): Promise<UIIssue[]> {
    const issues: UIIssue[] = [];

    const overlappingElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const overlaps: any[] = [];

      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const rect1 = elements[i].getBoundingClientRect();
          const rect2 = elements[j].getBoundingClientRect();

          if (
            rect1.width > 0 &&
            rect1.height > 0 &&
            rect2.width > 0 &&
            rect2.height > 0 &&
            !(rect1.right < rect2.left || 
              rect1.left > rect2.right || 
              rect1.bottom < rect2.top || 
              rect1.top > rect2.bottom)
          ) {
            const overlapArea =
              Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left)) *
              Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
            
            const minArea = Math.min(rect1.width * rect1.height, rect2.width * rect2.height);
            
            if (overlapArea > minArea * 0.5) {
              overlaps.push({
                element1: elements[i].tagName + (elements[i].id ? '#' + elements[i].id : ''),
                element2: elements[j].tagName + (elements[j].id ? '#' + elements[j].id : ''),
              });
            }
          }
        }
      }
      return overlaps;
    });

    for (const overlap of overlappingElements) {
      issues.push({
        type: 'overlap',
        description: `Overlapping elements detected: ${overlap.element1} and ${overlap.element2}`,
        selector: overlap.element1,
        url: route || url,
        viewport,
      });
    }

    const horizontalScroll = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth > body.clientWidth;
    });

    if (horizontalScroll) {
      issues.push({
        type: 'horizontal-scroll',
        description: 'Unwanted horizontal scrolling detected',
        selector: 'body',
        url: route || url,
        viewport,
      });
    }

    const offscreenElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a, input, select'));
      const offscreen: string[] = [];

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.right < 0 || rect.left > window.innerWidth) {
          offscreen.push(el.tagName + (el.id ? '#' + el.id : ''));
        }
      }
      return offscreen;
    });

    for (const element of offscreenElements) {
      issues.push({
        type: 'offscreen',
        description: `Interactive element off-screen: ${element}`,
        selector: element,
        url: route || url,
        viewport,
      });
    }

    const clippedText = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const clipped: string[] = [];

      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (
          (style.overflow === 'hidden' || style.overflow === 'auto' || style.overflow === 'scroll') &&
          el.scrollHeight > el.clientHeight
        ) {
          clipped.push(el.tagName + (el.id ? '#' + el.id : ''));
        }
      }
      return clipped;
    });

    for (const element of clippedText) {
      issues.push({
        type: 'clipped',
        description: `Clipped content detected: ${element}`,
        selector: element,
        url: route || url,
        viewport,
      });
    }

    return issues;
  }
}
