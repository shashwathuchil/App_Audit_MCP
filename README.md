# App Auditor MCP Server

A production-ready TypeScript MCP server for automated web application auditing. This tool performs comprehensive audits of web applications including performance, accessibility, SEO, security, UI/UX validation, and visual regression testing.

## Features

- **Automated Crawling**: Discovers routes, forms, buttons, links, menus, and modals
- **Performance Auditing**: Lighthouse-based Core Web Vitals (LCP, CLS, INP, TTFB, FCP, TBT)
- **Accessibility Testing**: WCAG compliance using axe-core
- **SEO Analysis**: Title tags, meta descriptions, heading hierarchy, image alt text
- **Security Review**: Exposed secrets, insecure cookies, mixed content, CSP issues
- **UI Validation**: Overlapping elements, clipped text, horizontal scrolling across viewports
- **Visual Regression**: Screenshot capture and rendering issue detection
- **Console Log Collection**: Errors, warnings, and runtime exceptions
- **Network Analysis**: Failed requests, 4xx/5xx responses, slow requests
- **Parallel Processing**: Concurrent route analysis for faster audits
- **Multi-format Reports**: HTML, Markdown, and JSON output

## Tech Stack

- TypeScript
- Node.js 18+
- MCP SDK
- Playwright
- Lighthouse
- axe-core
- Zod
- Winston (logging)
- p-limit (concurrency control)

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Local Installation

```bash
# Clone the repository
git clone <repository-url>
cd app-auditor-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Install Playwright browsers
npx playwright install chromium
```

### Docker Installation

```bash
# Build the Docker image
docker build -t app-auditor-mcp .

# Run with docker-compose
docker-compose up -d

# Or run directly
docker run -v $(pwd)/reports:/app/reports app-auditor-mcp
```

## MCP Client Configuration

### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "app-auditor": {
      "command": "node",
      "args": ["/path/to/app-auditor-mcp/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Docker Configuration

```json
{
  "mcpServers": {
    "app-auditor": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/path/to/reports:/app/reports",
        "app-auditor-mcp"
      ]
    }
  }
}
```

## Usage

### Setup Auditors

First, install and validate all required dependencies:

```json
{
  "tool": "setup_auditors",
  "arguments": {
    "installBrowsers": true,
    "validateDependencies": true
  }
}
```

### Crawl Application

Discover all routes and page elements:

```json
{
  "tool": "crawl_application",
  "arguments": {
    "url": "https://example.com",
    "depth": 5,
    "maxRoutes": 50,
    "authenticated": false
  }
}
```

### Comprehensive Audit

Run a full audit with all checks:

```json
{
  "tool": "analyze_application",
  "arguments": {
    "url": "https://example.com",
    "depth": 5,
    "mobile": true,
    "desktop": true,
    "authenticated": false,
    "maxRoutes": 50,
    "parallel": true,
    "concurrency": 3
  }
}
```

### Individual Audits

You can also run individual audits:

**Accessibility Audit:**
```json
{
  "tool": "run_accessibility_audit",
  "arguments": {
    "url": "https://example.com",
    "wcagLevel": "AA"
  }
}
```

**Performance Audit:**
```json
{
  "tool": "run_performance_audit",
  "arguments": {
    "url": "https://example.com",
    "throttling": "fast4G"
  }
}
```

**SEO Audit:**
```json
{
  "tool": "run_seo_audit",
  "arguments": {
    "url": "https://example.com"
  }
}
```

**Security Review:**
```json
{
  "tool": "run_security_review",
  "arguments": {
    "url": "https://example.com"
  }
}
```

**UI Validation:**
```json
{
  "tool": "run_ui_validation",
  "arguments": {
    "url": "https://example.com",
    "viewports": [
      { "width": 375, "height": 667 },
      { "width": 1920, "height": 1080 }
    ]
  }
}
```

**Visual Regression:**
```json
{
  "tool": "run_visual_regression",
  "arguments": {
    "url": "https://example.com",
    "viewports": [
      { "width": 375, "height": 667 },
      { "width": 1920, "height": 1080 }
    ]
  }
}
```

### Generate Reports

Generate reports from audit data:

```json
{
  "tool": "generate_report",
  "arguments": {
    "auditId": "audit-id",
    "format": "all",
    "outputPath": "./reports"
  }
}
```

## Report Output

Reports are generated in the `reports/` directory:

```
reports/
├── audit-report.html      # Interactive HTML report
├── audit-report.md        # Markdown report
├── audit-report.json      # Raw JSON data
├── screenshots/          # Page screenshots
├── logs/                 # Console logs
├── network/              # Network HAR data
└── traces/               # Performance traces
```

## Authentication

For authenticated applications, provide credentials:

```json
{
  "tool": "analyze_application",
  "arguments": {
    "url": "https://example.com",
    "authenticated": true,
    "authCredentials": {
      "loginUrl": "https://example.com/login",
      "username": "your-username",
      "password": "your-password",
      "loginSelectors": {
        "usernameField": "#username",
        "passwordField": "#password",
        "submitButton": "#login-button"
      }
    }
  }
}
```

## Configuration

### Environment Variables

- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (error, warn, info, debug)
- `PLAYWRIGHT_BROWSERS_PATH`: Path to Playwright browsers

### Audit Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | Target URL to audit |
| `depth` | number | 5 | Crawl depth |
| `maxRoutes` | number | 50 | Maximum routes to audit |
| `mobile` | boolean | true | Audit mobile viewport |
| `desktop` | boolean | true | Audit desktop viewport |
| `parallel` | boolean | true | Enable parallel processing |
| `concurrency` | number | 3 | Number of concurrent audits |
| `timeout` | number | 30000 | Request timeout in ms |

## CI/CD Integration

### GitHub Actions

```yaml
name: Application Audit

on:
  schedule:
    - cron: '0 0 * * *'
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npx playwright install chromium
      - name: Run Audit
        run: node dist/index.js
        env:
          AUDIT_URL: ${{ secrets.AUDIT_URL }}
      - uses: actions/upload-artifact@v3
        with:
          name: audit-reports
          path: reports/
```

## Development

### Scripts

```bash
# Development mode with watch
npm run dev

# Build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint

# Format code
npm run format
```

### Project Structure

```
src/
├── auditors/              # Audit implementations
│   ├── setup.ts          # Setup and dependency validation
│   ├── crawler.ts        # Route discovery
│   ├── console.ts        # Console log collection
│   ├── network.ts        # Network analysis
│   ├── accessibility.ts  # WCAG compliance
│   ├── performance.ts    # Lighthouse metrics
│   ├── ui-validation.ts  # UI issue detection
│   ├── visual-regression.ts # Screenshot capture
│   ├── seo.ts            # SEO analysis
│   └── security.ts       # Security review
├── reporters/             # Report generation
│   └── generator.ts      # HTML/Markdown/JSON reports
├── types/                 # TypeScript types
│   └── index.ts
├── utils/                 # Utilities
│   ├── logger.ts         # Winston logging
│   ├── schemas.ts        # Zod validation
│   ├── retry.ts          # Retry logic
│   └── storage.ts        # File operations
└── index.ts              # MCP server entry point
```

## Troubleshooting

### Browser Installation Issues

```bash
# Reinstall Playwright browsers
npx playwright install chromium --with-deps
```

### Permission Issues

```bash
# Ensure reports directory is writable
chmod -R 755 reports/
```

### Memory Issues

Reduce concurrency for large sites:

```json
{
  "concurrency": 1
}
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please open an issue on GitHub.
