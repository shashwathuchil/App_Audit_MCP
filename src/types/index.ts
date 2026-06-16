export interface AuditConfig {
  url: string;
  depth: number;
  mobile: boolean;
  desktop: boolean;
  authenticated: boolean;
  authCredentials?: AuthCredentials;
  maxRoutes?: number;
  timeout?: number;
}

export interface AuthCredentials {
  username?: string;
  password?: string;
  token?: string;
  loginUrl?: string;
  loginSelectors?: {
    usernameField?: string;
    passwordField?: string;
    submitButton?: string;
  };
}

export interface Route {
  url: string;
  title?: string;
  depth: number;
  parentUrl?: string;
  type: 'page' | 'api' | 'asset';
}

export interface SiteMap {
  baseUrl: string;
  routes: Route[];
  forms: Form[];
  buttons: Button[];
  links: Link[];
  menus: Menu[];
  modals: Modal[];
}

export interface Form {
  url: string;
  action: string;
  method: string;
  fields: FormField[];
  selector: string;
}

export interface FormField {
  name: string;
  type: string;
  required: boolean;
  selector: string;
}

export interface Button {
  text: string;
  url: string;
  selector: string;
  type: 'submit' | 'button' | 'link';
}

export interface Link {
  text: string;
  url: string;
  selector: string;
  internal: boolean;
}

export interface Menu {
  name: string;
  items: MenuItem[];
  selector: string;
}

export interface MenuItem {
  text: string;
  url: string;
  selector: string;
}

export interface Modal {
  name: string;
  trigger: string;
  selector: string;
}

export interface ConsoleLog {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  url: string;
  timestamp: Date;
  stack?: string;
}

export interface NetworkIssue {
  url: string;
  status: number;
  method: string;
  type: 'failed' | '4xx' | '5xx' | 'slow' | 'oversized';
  duration?: number;
  size?: number;
  timestamp: Date;
  headers?: Record<string, string>;
}

export interface AccessibilityIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: AccessibilityNode[];
  url: string;
}

export interface AccessibilityNode {
  html: string;
  target: string[];
  failureSummary: string;
}

export interface PerformanceMetrics {
  lcp: number;
  cls: number;
  inp: number;
  ttfb: number;
  fcp: number;
  tbt: number;
  url: string;
  timestamp: Date;
}

export interface PerformanceIssue {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  url: string;
  value?: number;
  recommendation: string;
}

export interface UIIssue {
  type: 'overlap' | 'clipped' | 'hidden' | 'offscreen' | 'z-index' | 'horizontal-scroll' | 'layout-break';
  description: string;
  selector: string;
  url: string;
  viewport: string;
  screenshot?: string;
}

export interface SEOIssue {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  url: string;
  recommendation: string;
}

export interface SecurityObservation {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  url: string;
  location?: string;
}

export interface AuditResult {
  timestamp: Date;
  config: AuditConfig;
  siteMap: SiteMap;
  consoleLogs: ConsoleLog[];
  networkIssues: NetworkIssue[];
  accessibilityIssues: AccessibilityIssue[];
  performanceMetrics: PerformanceMetrics[];
  performanceIssues: PerformanceIssue[];
  uiIssues: UIIssue[];
  seoIssues: SEOIssue[];
  securityObservations: SecurityObservation[];
  screenshots: Screenshot[];
}

export interface Screenshot {
  url: string;
  path: string;
  viewport: string;
  timestamp: Date;
}

export interface ReportData {
  auditResult: AuditResult;
  summary: ReportSummary;
  routeBreakdown: RouteBreakdown[];
}

export interface ReportSummary {
  overallScore: number;
  totalIssues: number;
  criticalIssues: number;
  warningCount: number;
  infoCount: number;
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  securityScore: number;
  routesAudited: number;
  duration: number;
}

export interface RouteBreakdown {
  route: string;
  status: 'passed' | 'failed' | 'warning';
  issues: number;
  performance: number;
  accessibility: number;
  seo: number;
  security: number;
}

export interface HealthStatus {
  playwrightInstalled: boolean;
  chromeInstalled: boolean;
  dependenciesValid: boolean;
  errors: string[];
  warnings: string[];
}
