import { ReportData } from '../types/index.js';
import logger from '../utils/logger.js';
import { saveReport, saveJSON } from '../utils/storage.js';
import { format } from 'date-fns';

export class ReportGenerator {
  async generate(
    reportData: ReportData,
    outputFormat: 'html' | 'markdown' | 'json' | 'all' = 'all',
    outputPath: string = './reports'
  ): Promise<{ html?: string; markdown?: string; json?: string }> {
    logger.info(`Generating reports in format: ${outputFormat}`);

    const results: { html?: string; markdown?: string; json?: string } = {};

    if (outputFormat === 'html' || outputFormat === 'all') {
      const html = this.generateHTML(reportData);
      const htmlPath = await saveReport(html, 'audit-report.html', outputPath);
      results.html = htmlPath;
      logger.info(`HTML report saved to ${htmlPath}`);
    }

    if (outputFormat === 'markdown' || outputFormat === 'all') {
      const markdown = this.generateMarkdown(reportData);
      const mdPath = await saveReport(markdown, 'audit-report.md', outputPath);
      results.markdown = mdPath;
      logger.info(`Markdown report saved to ${mdPath}`);
    }

    if (outputFormat === 'json' || outputFormat === 'all') {
      const jsonPath = await saveJSON(reportData, 'audit-report.json');
      results.json = jsonPath;
      logger.info(`JSON report saved to ${jsonPath}`);
    }

    return results;
  }

  private generateHTML(data: ReportData): string {
    const summary = data.summary;
    const result = data.auditResult;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Audit Report - ${result.config.url}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 1.1em; }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .card h3 { font-size: 0.9em; color: #666; text-transform: uppercase; margin-bottom: 10px; }
        .card .value { font-size: 2.5em; font-weight: bold; color: #333; }
        .card .value.good { color: #10b981; }
        .card .value.warning { color: #f59e0b; }
        .card .value.critical { color: #ef4444; }
        .section { background: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section h2 { color: #333; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #667eea; }
        .metrics-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .metrics-table th, .metrics-table td { padding: 15px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        .metrics-table th { background: #f9fafb; font-weight: 600; }
        .issue { padding: 20px; margin: 15px 0; border-left: 4px solid #667eea; background: #f9fafb; border-radius: 5px; }
        .issue.critical { border-left-color: #ef4444; }
        .issue.high { border-left-color: #f59e0b; }
        .issue.medium { border-left-color: #3b82f6; }
        .issue.low { border-left-color: #10b981; }
        .issue h4 { margin-bottom: 10px; color: #333; }
        .issue .severity { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; margin-bottom: 10px; }
        .issue .severity.critical { background: #fee2e2; color: #dc2626; }
        .issue .severity.high { background: #fef3c7; color: #d97706; }
        .issue .severity.medium { background: #dbeafe; color: #2563eb; }
        .issue .severity.low { background: #d1fae5; color: #059669; }
        .route-table { width: 100%; border-collapse: collapse; }
        .route-table th, .route-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; }
        .status-badge.passed { background: #d1fae5; color: #059669; }
        .status-badge.failed { background: #fee2e2; color: #dc2626; }
        .status-badge.warning { background: #fef3c7; color: #d97706; }
        .screenshot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .screenshot-item { border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .screenshot-item img { width: 100%; height: auto; display: block; }
        .screenshot-item .caption { padding: 10px; background: #f9fafb; font-size: 0.9em; color: #666; }
        .footer { text-align: center; padding: 30px; color: #666; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Application Audit Report</h1>
            <p>${result.config.url}</p>
            <p>Generated on ${format(result.timestamp, 'PPP p')}</p>
        </div>

        <div class="summary-cards">
            <div class="card">
                <h3>Overall Score</h3>
                <div class="value ${this.getScoreClass(summary.overallScore)}">${summary.overallScore}</div>
            </div>
            <div class="card">
                <h3>Total Issues</h3>
                <div class="value ${summary.totalIssues > 0 ? 'warning' : 'good'}">${summary.totalIssues}</div>
            </div>
            <div class="card">
                <h3>Critical Issues</h3>
                <div class="value ${summary.criticalIssues > 0 ? 'critical' : 'good'}">${summary.criticalIssues}</div>
            </div>
            <div class="card">
                <h3>Routes Audited</h3>
                <div class="value">${summary.routesAudited}</div>
            </div>
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            <table class="metrics-table">
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Status</th>
                </tr>
                ${result.performanceMetrics.map(m => `
                <tr>
                    <td>Largest Contentful Paint (LCP)</td>
                    <td>${(m.lcp / 1000).toFixed(2)}s</td>
                    <td>${this.getMetricStatus(m.lcp, 2500, 4000)}</td>
                </tr>
                <tr>
                    <td>Cumulative Layout Shift (CLS)</td>
                    <td>${m.cls.toFixed(3)}</td>
                    <td>${this.getMetricStatus(m.cls, 0.1, 0.25, true)}</td>
                </tr>
                <tr>
                    <td>Interaction to Next Paint (INP)</td>
                    <td>${(m.inp / 1000).toFixed(2)}s</td>
                    <td>${this.getMetricStatus(m.inp, 200, 500)}</td>
                </tr>
                <tr>
                    <td>Time to First Byte (TTFB)</td>
                    <td>${(m.ttfb / 1000).toFixed(2)}s</td>
                    <td>${this.getMetricStatus(m.ttfb, 600, 800)}</td>
                </tr>
                `).join('')}
            </table>
        </div>

        <div class="section">
            <h2>Category Scores</h2>
            <table class="metrics-table">
                <tr>
                    <th>Category</th>
                    <th>Score</th>
                </tr>
                <tr>
                    <td>Performance</td>
                    <td><span class="${this.getScoreClass(summary.performanceScore)}">${summary.performanceScore}/100</span></td>
                </tr>
                <tr>
                    <td>Accessibility</td>
                    <td><span class="${this.getScoreClass(summary.accessibilityScore)}">${summary.accessibilityScore}/100</span></td>
                </tr>
                <tr>
                    <td>SEO</td>
                    <td><span class="${this.getScoreClass(summary.seoScore)}">${summary.seoScore}/100</span></td>
                </tr>
                <tr>
                    <td>Security</td>
                    <td><span class="${this.getScoreClass(summary.securityScore)}">${summary.securityScore}/100</span></td>
                </tr>
            </table>
        </div>

        <div class="section">
            <h2>Route Breakdown</h2>
            <table class="route-table">
                <tr>
                    <th>Route</th>
                    <th>Status</th>
                    <th>Issues</th>
                    <th>Performance</th>
                    <th>Accessibility</th>
                    <th>SEO</th>
                </tr>
                ${data.routeBreakdown.map(r => `
                <tr>
                    <td>${r.route}</td>
                    <td><span class="status-badge ${r.status}">${r.status}</span></td>
                    <td>${r.issues}</td>
                    <td>${r.performance}/100</td>
                    <td>${r.accessibility}/100</td>
                    <td>${r.seo}/100</td>
                </tr>
                `).join('')}
            </table>
        </div>

        <div class="section">
            <h2>Issues</h2>
            ${this.renderIssuesHTML(result.accessibilityIssues, 'Accessibility')}
            ${this.renderIssuesHTML(result.performanceIssues, 'Performance')}
            ${this.renderIssuesHTML(result.seoIssues, 'SEO')}
            ${this.renderIssuesHTML(result.securityObservations, 'Security')}
            ${this.renderIssuesHTML(result.uiIssues, 'UI/UX')}
        </div>

        <div class="section">
            <h2>Screenshots</h2>
            <div class="screenshot-grid">
                ${result.screenshots.map(s => `
                <div class="screenshot-item">
                    <img src="${s.path}" alt="Screenshot of ${s.url}">
                    <div class="caption">${s.url} - ${s.viewport}</div>
                </div>
                `).join('')}
            </div>
        </div>

        <div class="footer">
            <p>Report generated by App Auditor MCP Server</p>
            <p>Audit duration: ${(summary.duration / 1000).toFixed(2)} seconds</p>
        </div>
    </div>
</body>
</html>`;
  }

  private renderIssuesHTML(issues: any[], category: string): string {
    if (issues.length === 0) return `<p>No ${category} issues found.</p>`;
    
    return `
    <h3>${category} Issues (${issues.length})</h3>
    ${issues.map(issue => `
    <div class="issue ${issue.severity || issue.impact || 'medium'}">
        <span class="severity ${issue.severity || issue.impact || 'medium'}">${issue.severity || issue.impact || 'medium'}</span>
        <h4>${issue.type || issue.id || issue.description}</h4>
        <p>${issue.description}</p>
        ${issue.recommendation ? `<p><strong>Recommendation:</strong> ${issue.recommendation}</p>` : ''}
        ${issue.url ? `<p><small>URL: ${issue.url}</small></p>` : ''}
    </div>
    `).join('')}`;
  }

  private generateMarkdown(data: ReportData): string {
    const summary = data.summary;
    const result = data.auditResult;

    return `# Application Audit Report

**URL:** ${result.config.url}
**Generated:** ${format(result.timestamp, 'PPP p')}
**Duration:** ${(summary.duration / 1000).toFixed(2)} seconds

## Executive Summary

- **Overall Score:** ${summary.overallScore}/100
- **Total Issues:** ${summary.totalIssues}
- **Critical Issues:** ${summary.criticalIssues}
- **Warning Count:** ${summary.warningCount}
- **Routes Audited:** ${summary.routesAudited}

## Category Scores

| Category | Score |
|----------|-------|
| Performance | ${summary.performanceScore}/100 |
| Accessibility | ${summary.accessibilityScore}/100 |
| SEO | ${summary.seoScore}/100 |
| Security | ${summary.securityScore}/100 |

## Performance Metrics

${result.performanceMetrics.map(m => `
- **LCP:** ${(m.lcp / 1000).toFixed(2)}s
- **CLS:** ${m.cls.toFixed(3)}
- **INP:** ${(m.inp / 1000).toFixed(2)}s
- **TTFB:** ${(m.ttfb / 1000).toFixed(2)}s
- **FCP:** ${(m.fcp / 1000).toFixed(2)}s
- **TBT:** ${(m.tbt / 1000).toFixed(2)}s
`).join('')}

## Route Breakdown

| Route | Status | Issues | Performance | Accessibility | SEO |
|-------|--------|--------|-------------|---------------|-----|
${data.routeBreakdown.map(r => `| ${r.route} | ${r.status} | ${r.issues} | ${r.performance}/100 | ${r.accessibility}/100 | ${r.seo}/100 |`).join('\n')}

## Issues

### Accessibility Issues (${result.accessibilityIssues.length})

${result.accessibilityIssues.map(i => `
- **[${i.impact?.toUpperCase()}]** ${i.id}: ${i.description}
  - Help: ${i.help}
  - URL: ${i.helpUrl}
`).join('')}

### Performance Issues (${result.performanceIssues.length})

${result.performanceIssues.map(i => `
- **[${i.severity?.toUpperCase()}]** ${i.type}: ${i.description}
  - Value: ${i.value}
  - Recommendation: ${i.recommendation}
`).join('')}

### SEO Issues (${result.seoIssues.length})

${result.seoIssues.map(i => `
- **[${i.severity?.toUpperCase()}]** ${i.type}: ${i.description}
  - Recommendation: ${i.recommendation}
`).join('')}

### Security Observations (${result.securityObservations.length})

${result.securityObservations.map(i => `
- **[${i.severity?.toUpperCase()}]** ${i.type}: ${i.description}
  - Location: ${i.location}
`).join('')}

### UI/UX Issues (${result.uiIssues.length})

${result.uiIssues.map(i => `
- **[${i.type}]** ${i.description}
  - Viewport: ${i.viewport}
  - Selector: ${i.selector}
`).join('')}

## Console Logs

${result.consoleLogs.map(l => `
- **[${l.level.toUpperCase()}]** ${l.message}
  - URL: ${l.url}
  - Time: ${l.timestamp.toISOString()}
`).join('')}

## Network Issues

${result.networkIssues.map(n => `
- **[${n.type.toUpperCase()}]** ${n.method} ${n.url}
  - Status: ${n.status}
  - Duration: ${n.duration}ms
`).join('')}

## Screenshots

${result.screenshots.map(s => `
- ${s.url} (${s.viewport}): ${s.path}
`).join('')}

---
*Report generated by App Auditor MCP Server*
`;
  }

  private getScoreClass(score: number): string {
    if (score >= 80) return 'good';
    if (score >= 50) return 'warning';
    return 'critical';
  }

  private getMetricStatus(value: number, good: number, needsImprovement: number, reverse: boolean = false): string {
    if (reverse) {
      if (value <= good) return '<span style="color: #10b981">Good</span>';
      if (value <= needsImprovement) return '<span style="color: #f59e0b">Needs Improvement</span>';
      return '<span style="color: #ef4444">Poor</span>';
    }
    if (value <= good) return '<span style="color: #10b981">Good</span>';
    if (value <= needsImprovement) return '<span style="color: #f59e0b">Needs Improvement</span>';
    return '<span style="color: #ef4444">Poor</span>';
  }
}
