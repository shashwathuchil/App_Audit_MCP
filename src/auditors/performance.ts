import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { PerformanceMetrics, PerformanceIssue } from '../types/index.js';
import logger from '../utils/logger.js';

export class PerformanceAuditor {

  async audit(
    url: string,
    route?: string,
    throttling: 'offline' | 'slow3G' | 'fast3G' | 'slow4G' | 'fast4G' = 'fast4G'
  ): Promise<{ metrics: PerformanceMetrics; issues: PerformanceIssue[] }> {
    logger.info(`Running performance audit for ${url} with throttling ${throttling}`);

    const issues: PerformanceIssue[] = [];

    try {
      const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
      const options = {
        logLevel: 'info' as const,
        output: 'json' as const,
        onlyCategories: ['performance'],
        port: chrome.port,
        throttlingMethod: 'devtools' as const,
        throttling: this.getThrottlingSettings(throttling),
      };

      const runnerResult = await lighthouse(url, options);
      await chrome.kill();

      const report = JSON.parse(runnerResult.report as string);
      const audits = report.audits;
      const categories = report.categories;

      const metrics: PerformanceMetrics = {
        lcp: audits['largest-contentful-paint']?.numericValue || 0,
        cls: audits['cumulative-layout-shift']?.numericValue || 0,
        inp: audits['interaction-to-next-paint']?.numericValue || 0,
        ttfb: audits['time-to-first-byte']?.numericValue || 0,
        fcp: audits['first-contentful-paint']?.numericValue || 0,
        tbt: audits['total-blocking-time']?.numericValue || 0,
        url: route || url,
        timestamp: new Date(),
      };

      issues.push(...this.extractPerformanceIssues(audits, route || url));

      logger.info(`Performance audit completed. Score: ${categories.performance.score * 100}`);
      return { metrics, issues };
    } catch (error) {
      logger.error('Failed to run performance audit:', error);
      throw error;
    }
  }

  private getThrottlingSettings(throttling: string) {
    const settings: Record<string, any> = {
      offline: {
        offline: true,
        downloadThroughput: 0,
        uploadThroughput: 0,
        latency: 0,
      },
      slow3G: {
        offline: false,
        downloadThroughput: 500 * 1024 / 8,
        uploadThroughput: 500 * 1024 / 8,
        latency: 400,
      },
      fast3G: {
        offline: false,
        downloadThroughput: 1.6 * 1024 * 1024 / 8,
        uploadThroughput: 750 * 1024 / 8,
        latency: 100,
      },
      slow4G: {
        offline: false,
        downloadThroughput: 4 * 1024 * 1024 / 8,
        uploadThroughput: 3 * 1024 * 1024 / 8,
        latency: 20,
      },
      fast4G: {
        offline: false,
        downloadThroughput: 10 * 1024 * 1024 / 8,
        uploadThroughput: 10 * 1024 * 1024 / 8,
        latency: 20,
      },
    };
    return settings[throttling] || settings.fast4G;
  }

  private extractPerformanceIssues(audits: any, url: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    const problematicAudits = [
      'largest-contentful-paint',
      'cumulative-layout-shift',
      'interaction-to-next-paint',
      'time-to-first-byte',
      'first-contentful-paint',
      'total-blocking-time',
      'speed-index',
      'render-blocking-resources',
      'unused-javascript',
      'unused-css-rules',
      'modern-image-formats',
      'uses-responsive-images',
      'efficient-animated-content',
      'minified-css',
      'minified-javascript',
      'uses-text-compression',
      'uses-long-cache-ttl',
      'document-size',
    ];

    for (const auditId of problematicAudits) {
      const audit = audits[auditId];
      if (audit && audit.score !== 1 && audit.score !== null) {
        issues.push({
          type: auditId,
          description: audit.title || auditId,
          severity: this.getPerformanceSeverity(audit.score, auditId),
          url,
          value: audit.numericValue,
          recommendation: audit.description || 'See Lighthouse documentation for details',
        });
      }
    }

    return issues;
  }

  private getPerformanceSeverity(score: number, _auditId: string): PerformanceIssue['severity'] {
    if (score === 0) return 'high';
    if (score < 0.5) return 'high';
    if (score < 0.75) return 'medium';
    return 'low';
  }

  calculateScore(metrics: PerformanceMetrics, issues: PerformanceIssue[]): number {
    let score = 100;

    if (metrics.lcp > 2500) score -= 15;
    if (metrics.lcp > 4000) score -= 15;
    if (metrics.cls > 0.1) score -= 15;
    if (metrics.cls > 0.25) score -= 15;
    if (metrics.inp > 200) score -= 10;
    if (metrics.inp > 500) score -= 10;
    if (metrics.ttfb > 600) score -= 10;
    if (metrics.tbt > 200) score -= 10;
    if (metrics.tbt > 600) score -= 10;

    for (const issue of issues) {
      if (issue.severity === 'high') score -= 5;
      if (issue.severity === 'medium') score -= 2;
    }

    return Math.max(0, score);
  }
}
