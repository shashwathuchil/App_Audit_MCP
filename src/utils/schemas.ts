import { z } from 'zod';

export const AuthCredentialsSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
  loginUrl: z.string().url().optional(),
  loginSelectors: z
    .object({
      usernameField: z.string().optional(),
      passwordField: z.string().optional(),
      submitButton: z.string().optional(),
    })
    .optional(),
});

export const AuditConfigSchema = z.object({
  url: z.string().url(),
  depth: z.number().int().min(1).max(10).default(5),
  mobile: z.boolean().default(true),
  desktop: z.boolean().default(true),
  authenticated: z.boolean().default(false),
  authCredentials: AuthCredentialsSchema.optional(),
  maxRoutes: z.number().int().min(1).max(100).default(50),
  timeout: z.number().int().min(5000).max(300000).default(30000),
});

export const SetupAuditorsSchema = z.object({
  installBrowsers: z.boolean().default(true),
  validateDependencies: z.boolean().default(true),
});

export const CrawlApplicationSchema = z.object({
  url: z.string().url(),
  depth: z.number().int().min(1).max(10).default(5),
  maxRoutes: z.number().int().min(1).max(100).default(50),
  authenticated: z.boolean().default(false),
  authCredentials: AuthCredentialsSchema.optional(),
});

export const CollectConsoleLogsSchema = z.object({
  url: z.string().url(),
  route: z.string().optional(),
});

export const CollectNetworkIssuesSchema = z.object({
  url: z.string().url(),
  route: z.string().optional(),
  slowThreshold: z.number().int().min(100).max(10000).default(1000),
  maxSize: z.number().int().min(1024).max(10485760).default(1048576),
});

export const RunAccessibilityAuditSchema = z.object({
  url: z.string().url(),
  route: z.string().optional(),
  wcagLevel: z.enum(['A', 'AA', 'AAA']).default('AA'),
});

export const RunPerformanceAuditSchema = z.object({
  url: z.string().url(),
  route: z.string().optional(),
  throttling: z
    .enum(['offline', 'slow3G', 'fast3G', 'slow4G', 'fast4G'])
    .default('fast4G'),
});

export const RunUIValidationSchema = z.object({
  url: z.string().url(),
  route: z.string().optional(),
  viewports: z
    .array(
      z.object({
        width: z.number().int(),
        height: z.number().int(),
      })
    )
    .default([
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ]),
});

export const RunVisualRegressionSchema = z.object({
  url: z.string().url(),
  route: z.string().optional(),
  viewports: z
    .array(
      z.object({
        width: z.number().int(),
        height: z.number().int(),
      })
    )
    .default([
      { width: 375, height: 667 },
      { width: 1920, height: 1080 },
    ]),
});

export const RunSEOAuditSchema = z.object({
  url: z.string().url(),
  route: z.string().optional(),
});

export const RunSecurityReviewSchema = z.object({
  url: z.string().url(),
  route: z.string().optional(),
});

export const AnalyzeApplicationSchema = z.object({
  url: z.string().url(),
  depth: z.number().int().min(1).max(10).default(5),
  mobile: z.boolean().default(true),
  desktop: z.boolean().default(true),
  authenticated: z.boolean().default(false),
  authCredentials: AuthCredentialsSchema.optional(),
  maxRoutes: z.number().int().min(1).max(100).default(50),
  parallel: z.boolean().default(true),
  concurrency: z.number().int().min(1).max(10).default(3),
});

export const GenerateReportSchema = z.object({
  auditId: z.string(),
  format: z.enum(['html', 'markdown', 'json', 'all']).default('all'),
  outputPath: z.string().default('./reports'),
});
