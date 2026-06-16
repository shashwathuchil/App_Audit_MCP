import { chromium, Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AccessibilityIssue } from '../types/index.js';
import logger from '../utils/logger.js';
import { withRetry, withTimeout } from '../utils/retry.js';

export class AccessibilityAuditor {
  private browser: Browser | null = null;

  async audit(url: string, route?: string, wcagLevel: 'A' | 'AA' | 'AAA' = 'AA'): Promise<AccessibilityIssue[]> {
    logger.info(`Running accessibility audit for ${url} with WCAG ${wcagLevel}`);

    const issues: AccessibilityIssue[] = [];

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

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2' + wcagLevel.toLowerCase()])
        .analyze();

      for (const result of accessibilityScanResults.violations) {
        const issue: AccessibilityIssue = {
          id: result.id,
          impact: result.impact as AccessibilityIssue['impact'],
          description: result.description,
          help: result.help,
          helpUrl: result.helpUrl,
          tags: result.tags || [],
          nodes: result.nodes.map((node: any) => ({
            html: node.html,
            target: node.target,
            failureSummary: node.failureSummary,
          })),
          url: route || url,
        };
        issues.push(issue);
      }

      await context.close();
      await this.browser.close();

      logger.info(`Found ${issues.length} accessibility issues`);
      return issues;
    } catch (error) {
      logger.error('Failed to run accessibility audit:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  calculateScore(issues: AccessibilityIssue[]): number {
    if (issues.length === 0) return 100;

    const criticalCount = issues.filter((i) => i.impact === 'critical').length;
    const seriousCount = issues.filter((i) => i.impact === 'serious').length;
    const moderateCount = issues.filter((i) => i.impact === 'moderate').length;
    const minorCount = issues.filter((i) => i.impact === 'minor').length;

    const weightedScore = 100 - (criticalCount * 25 + seriousCount * 10 + moderateCount * 5 + minorCount * 1);
    return Math.max(0, weightedScore);
  }
}
