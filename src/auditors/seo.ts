import { chromium, Browser } from '@playwright/test';
import { SEOIssue } from '../types/index.js';
import logger from '../utils/logger.js';
import { withRetry, withTimeout } from '../utils/retry.js';

export class SEOAuditor {
  private browser: Browser | null = null;

  async audit(url: string, route?: string): Promise<SEOIssue[]> {
    logger.info(`Running SEO audit for ${url}`);

    const issues: SEOIssue[] = [];

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

      const title = await page.title();
      if (!title || title.length === 0) {
        issues.push({
          type: 'missing-title',
          description: 'Page is missing a title tag',
          severity: 'high',
          url: route || url,
          recommendation: 'Add a descriptive title tag to the page',
        });
      } else if (title.length > 60) {
        issues.push({
          type: 'title-too-long',
          description: `Title tag is too long (${title.length} characters)`,
          severity: 'medium',
          url: route || url,
          recommendation: 'Keep title tag under 60 characters for optimal display in search results',
        });
      }

      const metaDescription = await page.$eval('meta[name="description"]', (el: any) => el.content).catch(() => '');
      if (!metaDescription || metaDescription.length === 0) {
        issues.push({
          type: 'missing-meta-description',
          description: 'Page is missing a meta description',
          severity: 'high',
          url: route || url,
          recommendation: 'Add a meta description tag to improve click-through rates from search results',
        });
      } else if (metaDescription.length > 160) {
        issues.push({
          type: 'meta-description-too-long',
          description: `Meta description is too long (${metaDescription.length} characters)`,
          severity: 'medium',
          url: route || url,
          recommendation: 'Keep meta description under 160 characters for optimal display in search results',
        });
      }

      const canonical = await page.$eval('link[rel="canonical"]', (el: any) => el.href).catch(() => '');
      if (!canonical) {
        issues.push({
          type: 'missing-canonical',
          description: 'Page is missing a canonical URL',
          severity: 'medium',
          url: route || url,
          recommendation: 'Add a canonical tag to prevent duplicate content issues',
        });
      }

      const h1Count = await page.$$eval('h1', (h1s) => h1s.length);
      if (h1Count === 0) {
        issues.push({
          type: 'missing-h1',
          description: 'Page is missing an H1 heading',
          severity: 'high',
          url: route || url,
          recommendation: 'Add a single H1 heading to describe the main content of the page',
        });
      } else if (h1Count > 1) {
        issues.push({
          type: 'multiple-h1',
          description: `Page has ${h1Count} H1 headings (should have exactly one)`,
          severity: 'medium',
          url: route || url,
          recommendation: 'Use a single H1 heading and use H2-H6 for subheadings',
        });
      }

      const headingStructure = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const structure: string[] = [];
        let lastLevel = 0;

        for (const heading of headings) {
          const level = parseInt(heading.tagName[1]);
          if (level > lastLevel + 1) {
            structure.push(`Skipped heading level: from H${lastLevel} to H${level}`);
          }
          lastLevel = level;
        }
        return structure;
      });

      for (const issue of headingStructure) {
        issues.push({
          type: 'heading-structure',
          description: issue,
          severity: 'low',
          url: route || url,
          recommendation: 'Maintain a proper heading hierarchy without skipping levels',
        });
      }

      const imagesWithoutAlt = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.filter((img: any) => !img.alt || img.alt.length === 0).length;
      });

      if (imagesWithoutAlt > 0) {
        issues.push({
          type: 'images-without-alt',
          description: `${imagesWithoutAlt} images are missing alt text`,
          severity: 'medium',
          url: route || url,
          recommendation: 'Add descriptive alt text to all images for accessibility and SEO',
        });
      }

      const robotsMeta = await page.$eval('meta[name="robots"]', (el: any) => el.content).catch(() => '');
      if (robotsMeta.includes('noindex')) {
        issues.push({
          type: 'noindex',
          description: 'Page has noindex directive',
          severity: 'low',
          url: route || url,
          recommendation: 'Review if this page should be indexed by search engines',
        });
      }

      const viewportMeta = await page.$eval('meta[name="viewport"]', (el: any) => el.content).catch(() => '');
      if (!viewportMeta) {
        issues.push({
          type: 'missing-viewport',
          description: 'Page is missing viewport meta tag',
          severity: 'high',
          url: route || url,
          recommendation: 'Add viewport meta tag for mobile optimization',
        });
      }

      await context.close();
      await this.browser.close();

      logger.info(`Found ${issues.length} SEO issues`);
      return issues;
    } catch (error) {
      logger.error('Failed to run SEO audit:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  calculateScore(issues: SEOIssue[]): number {
    if (issues.length === 0) return 100;

    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'high') score -= 10;
      if (issue.severity === 'medium') score -= 5;
      if (issue.severity === 'low') score -= 2;
    }
    return Math.max(0, score);
  }
}
