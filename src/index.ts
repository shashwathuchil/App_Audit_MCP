#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import logger from './utils/logger.js';
import { SetupAuditor } from './auditors/setup.js';
import { Crawler } from './auditors/crawler.js';
import { ConsoleCollector } from './auditors/console.js';
import { NetworkCollector } from './auditors/network.js';
import { AccessibilityAuditor } from './auditors/accessibility.js';
import { PerformanceAuditor } from './auditors/performance.js';
import { UIValidator } from './auditors/ui-validation.js';
import { VisualRegressionAuditor } from './auditors/visual-regression.js';
import { SEOAuditor } from './auditors/seo.js';
import { SecurityAuditor } from './auditors/security.js';
import { ReportGenerator } from './reporters/generator.js';
import {
  SetupAuditorsSchema,
  CrawlApplicationSchema,
  CollectConsoleLogsSchema,
  CollectNetworkIssuesSchema,
  RunAccessibilityAuditSchema,
  RunPerformanceAuditSchema,
  RunUIValidationSchema,
  RunVisualRegressionSchema,
  RunSEOAuditSchema,
  RunSecurityReviewSchema,
  AnalyzeApplicationSchema,
  GenerateReportSchema,
} from './utils/schemas.js';
import { AuditConfig, AuditResult, ReportData, ReportSummary, RouteBreakdown } from './types/index.js';
import pLimit from 'p-limit';
import { ensureDirectories } from './utils/storage.js';

const server = new Server(
  {
    name: 'app-auditor-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'setup_auditors',
        description: 'Install and validate Playwright browsers, Chrome DevTools MCP server, and dependencies',
        inputSchema: SetupAuditorsSchema,
      },
      {
        name: 'crawl_application',
        description: 'Crawl a web application to discover routes, forms, buttons, links, menus, and modals',
        inputSchema: CrawlApplicationSchema,
      },
      {
        name: 'collect_console_logs',
        description: 'Collect console errors, warnings, and runtime exceptions from a page',
        inputSchema: CollectConsoleLogsSchema,
      },
      {
        name: 'collect_network_issues',
        description: 'Collect failed requests, 4xx/5xx responses, slow requests, and oversized payloads',
        inputSchema: CollectNetworkIssuesSchema,
      },
      {
        name: 'run_accessibility_audit',
        description: 'Run accessibility audit using axe-core to detect WCAG violations',
        inputSchema: RunAccessibilityAuditSchema,
      },
      {
        name: 'run_performance_audit',
        description: 'Run performance audit using Lighthouse to collect Core Web Vitals',
        inputSchema: RunPerformanceAuditSchema,
      },
      {
        name: 'run_ui_validation',
        description: 'Detect UI issues like overlapping elements, clipped text, horizontal scrolling across viewports',
        inputSchema: RunUIValidationSchema,
      },
      {
        name: 'run_visual_regression',
        description: 'Capture screenshots across multiple viewports and detect rendering issues',
        inputSchema: RunVisualRegressionSchema,
      },
      {
        name: 'run_seo_audit',
        description: 'Run SEO audit to check title tags, meta descriptions, headings, and other SEO factors',
        inputSchema: RunSEOAuditSchema,
      },
      {
        name: 'run_security_review',
        description: 'Run security review to detect exposed secrets, insecure cookies, mixed content, and CSP issues',
        inputSchema: RunSecurityReviewSchema,
      },
      {
        name: 'analyze_application',
        description: 'Master workflow that runs all audits on a web application and generates a comprehensive report',
        inputSchema: AnalyzeApplicationSchema,
      },
      {
        name: 'generate_report',
        description: 'Generate HTML, Markdown, and JSON reports from audit data',
        inputSchema: GenerateReportSchema,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'setup_auditors': {
        const parsed = SetupAuditorsSchema.parse(args);
        const auditor = new SetupAuditor();
        const result = await auditor.setup(parsed);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'crawl_application': {
        const parsed = CrawlApplicationSchema.parse(args);
        const crawler = new Crawler();
        const result = await crawler.crawl(
          parsed.url,
          parsed.depth,
          parsed.maxRoutes,
          parsed.authenticated,
          parsed.authCredentials
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'collect_console_logs': {
        const parsed = CollectConsoleLogsSchema.parse(args);
        const collector = new ConsoleCollector();
        const result = await collector.collect(parsed.url, parsed.route);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'collect_network_issues': {
        const parsed = CollectNetworkIssuesSchema.parse(args);
        const collector = new NetworkCollector();
        const result = await collector.collect(
          parsed.url,
          parsed.route,
          parsed.slowThreshold,
          parsed.maxSize
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'run_accessibility_audit': {
        const parsed = RunAccessibilityAuditSchema.parse(args);
        const auditor = new AccessibilityAuditor();
        const result = await auditor.audit(parsed.url, parsed.route, parsed.wcagLevel);
        const score = auditor.calculateScore(result);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ issues: result, score }, null, 2),
            },
          ],
        };
      }

      case 'run_performance_audit': {
        const parsed = RunPerformanceAuditSchema.parse(args);
        const auditor = new PerformanceAuditor();
        const result = await auditor.audit(parsed.url, parsed.route, parsed.throttling);
        const score = auditor.calculateScore(result.metrics, result.issues);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ metrics: result.metrics, issues: result.issues, score }, null, 2),
            },
          ],
        };
      }

      case 'run_ui_validation': {
        const parsed = RunUIValidationSchema.parse(args);
        const validator = new UIValidator();
        const result = await validator.validate(parsed.url, parsed.route, parsed.viewports);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'run_visual_regression': {
        const parsed = RunVisualRegressionSchema.parse(args);
        const auditor = new VisualRegressionAuditor();
        const screenshots = await auditor.capture(parsed.url, parsed.route, parsed.viewports);
        const renderingIssues = await auditor.detectRenderingIssues(parsed.url, parsed.route);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ screenshots, renderingIssues }, null, 2),
            },
          ],
        };
      }

      case 'run_seo_audit': {
        const parsed = RunSEOAuditSchema.parse(args);
        const auditor = new SEOAuditor();
        const result = await auditor.audit(parsed.url, parsed.route);
        const score = auditor.calculateScore(result);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ issues: result, score }, null, 2),
            },
          ],
        };
      }

      case 'run_security_review': {
        const parsed = RunSecurityReviewSchema.parse(args);
        const auditor = new SecurityAuditor();
        const result = await auditor.review(parsed.url, parsed.route);
        const score = auditor.calculateScore(result);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ observations: result, score }, null, 2),
            },
          ],
        };
      }

      case 'analyze_application': {
        const parsed = AnalyzeApplicationSchema.parse(args);
        const result = await analyzeApplication(parsed);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'generate_report': {
        const parsed = GenerateReportSchema.parse(args);
        const generator = new ReportGenerator();
        const reportData = await readReportData(parsed.auditId);
        const result = await generator.generate(
          reportData,
          parsed.format,
          parsed.outputPath
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error(`Error executing tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

async function analyzeApplication(config: z.infer<typeof AnalyzeApplicationSchema>) {
  logger.info(`Starting comprehensive audit of ${config.url}`);
  const startTime = Date.now();

  await ensureDirectories();

  const auditResult: AuditResult = {
    timestamp: new Date(),
    config: config as AuditConfig,
    siteMap: {
      baseUrl: config.url,
      routes: [],
      forms: [],
      buttons: [],
      links: [],
      menus: [],
      modals: [],
    },
    consoleLogs: [],
    networkIssues: [],
    accessibilityIssues: [],
    performanceMetrics: [],
    performanceIssues: [],
    uiIssues: [],
    seoIssues: [],
    securityObservations: [],
    screenshots: [],
  };

  const crawler = new Crawler();
  const consoleCollector = new ConsoleCollector();
  const networkCollector = new NetworkCollector();
  const accessibilityAuditor = new AccessibilityAuditor();
  const performanceAuditor = new PerformanceAuditor();
  const uiValidator = new UIValidator();
  const visualRegressionAuditor = new VisualRegressionAuditor();
  const seoAuditor = new SEOAuditor();
  const securityAuditor = new SecurityAuditor();

  logger.info('Step 1: Crawling application');
  auditResult.siteMap = await crawler.crawl(
    config.url,
    config.depth,
    config.maxRoutes,
    config.authenticated,
    config.authCredentials
  );

  const routesToAudit = auditResult.siteMap.routes.slice(0, config.maxRoutes);
  logger.info(`Found ${routesToAudit.length} routes to audit`);

  const limit = pLimit(config.concurrency);
  const viewports = config.mobile || config.desktop
    ? [
        ...(config.mobile ? [{ width: 375, height: 667 }] : []),
        ...(config.desktop ? [{ width: 1920, height: 1080 }] : []),
      ]
    : [{ width: 1920, height: 1080 }];

  logger.info('Step 2: Running parallel audits on all routes');
  const auditTasks = routesToAudit.map((route) =>
    limit(async () => {
      logger.info(`Auditing route: ${route.url}`);

      const [consoleLogs, networkIssues, accessibilityResult, performanceResult, uiIssues, seoResult, securityResult] =
        await Promise.all([
          consoleCollector.collect(route.url, route.url).catch((e) => {
            logger.warn(`Console collection failed for ${route.url}:`, e);
            return [];
          }),
          networkCollector.collect(route.url, route.url).catch((e) => {
            logger.warn(`Network collection failed for ${route.url}:`, e);
            return [];
          }),
          accessibilityAuditor.audit(route.url, route.url).catch((e) => {
            logger.warn(`Accessibility audit failed for ${route.url}:`, e);
            return [];
          }),
          performanceAuditor.audit(route.url, route.url).catch((e) => {
            logger.warn(`Performance audit failed for ${route.url}:`, e);
            return { metrics: { lcp: 0, cls: 0, inp: 0, ttfb: 0, fcp: 0, tbt: 0, url: route.url, timestamp: new Date() }, issues: [] };
          }),
          uiValidator.validate(route.url, route.url, viewports).catch((e) => {
            logger.warn(`UI validation failed for ${route.url}:`, e);
            return [];
          }),
          seoAuditor.audit(route.url, route.url).catch((e) => {
            logger.warn(`SEO audit failed for ${route.url}:`, e);
            return [];
          }),
          securityAuditor.review(route.url, route.url).catch((e) => {
            logger.warn(`Security review failed for ${route.url}:`, e);
            return [];
          }),
        ]);

      return {
        route,
        consoleLogs,
        networkIssues,
        accessibilityResult,
        performanceResult,
        uiIssues,
        seoResult,
        securityResult,
      };
    })
  );

  const results = await Promise.all(auditTasks);

  logger.info('Step 3: Aggregating results');
  for (const result of results) {
    auditResult.consoleLogs.push(...result.consoleLogs);
    auditResult.networkIssues.push(...result.networkIssues);
    auditResult.accessibilityIssues.push(...result.accessibilityResult);
    auditResult.performanceMetrics.push(result.performanceResult.metrics);
    auditResult.performanceIssues.push(...result.performanceResult.issues);
    auditResult.uiIssues.push(...result.uiIssues);
    auditResult.seoIssues.push(...result.seoResult);
    auditResult.securityObservations.push(...result.securityResult);
  }

  logger.info('Step 4: Capturing screenshots');
  const screenshots = await visualRegressionAuditor.capture(config.url, config.url, viewports);
  auditResult.screenshots.push(...screenshots);

  const accessibilityAuditorForScore = new AccessibilityAuditor();
  const performanceAuditorForScore = new PerformanceAuditor();
  const seoAuditorForScore = new SEOAuditor();
  const securityAuditorForScore = new SecurityAuditor();

  const summary: ReportSummary = {
    overallScore: 0,
    totalIssues:
      auditResult.accessibilityIssues.length +
      auditResult.performanceIssues.length +
      auditResult.seoIssues.length +
      auditResult.securityObservations.length +
      auditResult.uiIssues.length,
    criticalIssues:
      auditResult.accessibilityIssues.filter((i) => i.impact === 'critical').length +
      auditResult.performanceIssues.filter((i) => i.severity === 'high').length +
      auditResult.seoIssues.filter((i) => i.severity === 'high').length +
      auditResult.securityObservations.filter((i) => i.severity === 'high').length,
    warningCount:
      auditResult.accessibilityIssues.filter((i) => i.impact === 'serious').length +
      auditResult.performanceIssues.filter((i) => i.severity === 'medium').length +
      auditResult.seoIssues.filter((i) => i.severity === 'medium').length +
      auditResult.securityObservations.filter((i) => i.severity === 'medium').length,
    infoCount:
      auditResult.accessibilityIssues.filter((i) => i.impact === 'moderate' || i.impact === 'minor').length +
      auditResult.performanceIssues.filter((i) => i.severity === 'low').length +
      auditResult.seoIssues.filter((i) => i.severity === 'low').length +
      auditResult.securityObservations.filter((i) => i.severity === 'low').length,
    performanceScore: performanceAuditorForScore.calculateScore(
      auditResult.performanceMetrics[0] || { lcp: 0, cls: 0, inp: 0, ttfb: 0, fcp: 0, tbt: 0, url: '', timestamp: new Date() },
      auditResult.performanceIssues
    ),
    accessibilityScore: accessibilityAuditorForScore.calculateScore(auditResult.accessibilityIssues),
    seoScore: seoAuditorForScore.calculateScore(auditResult.seoIssues),
    securityScore: securityAuditorForScore.calculateScore(auditResult.securityObservations),
    routesAudited: routesToAudit.length,
    duration: Date.now() - startTime,
  };

  summary.overallScore = Math.round(
    (summary.performanceScore + summary.accessibilityScore + summary.seoScore + summary.securityScore) / 4
  );

  const routeBreakdown: RouteBreakdown[] = results.map((r) => ({
    route: r.route.url,
    status: r.consoleLogs.length > 0 || r.networkIssues.length > 0 ? 'warning' : 'passed',
    issues: r.consoleLogs.length + r.networkIssues.length + r.accessibilityResult.length + r.seoResult.length + r.securityResult.length,
    performance: performanceAuditorForScore.calculateScore(r.performanceResult.metrics, r.performanceResult.issues),
    accessibility: accessibilityAuditorForScore.calculateScore(r.accessibilityResult),
    seo: seoAuditorForScore.calculateScore(r.seoResult),
    security: securityAuditorForScore.calculateScore(r.securityResult),
  }));

  const reportData: ReportData = {
    auditResult,
    summary,
    routeBreakdown,
  };

  logger.info('Step 5: Generating reports');
  const generator = new ReportGenerator();
  await generator.generate(reportData, 'all');

  logger.info(`Audit completed in ${(summary.duration / 1000).toFixed(2)} seconds`);
  return reportData;
}

async function readReportData(auditId: string): Promise<ReportData> {
  const { readJSON } = await import('./utils/storage.js');
  return readJSON(`audit-report-${auditId}.json`);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.error('App Auditor MCP Server running on stdio');
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
