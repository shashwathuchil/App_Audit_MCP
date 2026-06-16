import { z } from 'zod';
import logger from './logger.js';

export interface AppConfig {
  url: string;
  depth: number;
  maxRoutes: number;
  mobile: boolean;
  desktop: boolean;
  authenticated: boolean;
  concurrency: number;
  timeout: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  enableProgress: boolean;
  maxMemoryMB: number;
}

const AppConfigSchema = z.object({
  url: z.string().url(),
  depth: z.number().int().min(1).max(10).default(5),
  maxRoutes: z.number().int().min(1).max(100).default(50),
  mobile: z.boolean().default(true),
  desktop: z.boolean().default(true),
  authenticated: z.boolean().default(false),
  concurrency: z.number().int().min(1).max(10).default(3),
  timeout: z.number().int().min(5000).max(300000).default(30000),
  cacheEnabled: z.boolean().default(true),
  cacheTTL: z.number().int().min(0).default(3600000),
  enableProgress: z.boolean().default(true),
  maxMemoryMB: z.number().int().min(512).default(4096),
});

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private defaults: Partial<AppConfig> = {
    depth: 5,
    maxRoutes: 50,
    mobile: true,
    desktop: true,
    authenticated: false,
    concurrency: 3,
    timeout: 30000,
    cacheEnabled: true,
    cacheTTL: 3600000,
    enableProgress: true,
    maxMemoryMB: 4096,
  };

  private constructor() {
    this.config = this.loadDefaults();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadDefaults(): AppConfig {
    return {
      url: '',
      ...this.defaults,
    } as AppConfig;
  }

  validate(config: Partial<AppConfig>): AppConfig {
    try {
      const validated = AppConfigSchema.parse({
        ...this.defaults,
        ...config,
      });
      
      logger.info('Configuration validated successfully');
      return validated as AppConfig;
    } catch (error) {
      logger.error('Configuration validation failed:', error);
      throw new Error(`Invalid configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  setConfig(config: Partial<AppConfig>): void {
    this.config = this.validate(config);
    logger.info('Configuration updated', this.config);
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AppConfig>): void {
    this.config = this.validate({
      ...this.config,
      ...updates,
    });
    logger.info('Configuration updated', updates);
  }

  resetToDefaults(): void {
    this.config = this.loadDefaults();
    logger.info('Configuration reset to defaults');
  }

  setDefaults(defaults: Partial<AppConfig>): void {
    this.defaults = { ...this.defaults, ...defaults };
    logger.info('Default configuration updated', this.defaults);
  }

  getDefaults(): Partial<AppConfig> {
    return { ...this.defaults };
  }

  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  sanitizeConfig(config: Partial<AppConfig>): Partial<AppConfig> {
    const sanitized: Partial<AppConfig> = {};

    if (config.url && this.validateUrl(config.url)) {
      sanitized.url = config.url;
    }

    if (config.depth !== undefined) {
      sanitized.depth = Math.max(1, Math.min(10, config.depth));
    }

    if (config.maxRoutes !== undefined) {
      sanitized.maxRoutes = Math.max(1, Math.min(100, config.maxRoutes));
    }

    if (config.concurrency !== undefined) {
      sanitized.concurrency = Math.max(1, Math.min(10, config.concurrency));
    }

    if (config.timeout !== undefined) {
      sanitized.timeout = Math.max(5000, Math.min(300000, config.timeout));
    }

    if (config.mobile !== undefined) {
      sanitized.mobile = config.mobile;
    }

    if (config.desktop !== undefined) {
      sanitized.desktop = config.desktop;
    }

    if (config.authenticated !== undefined) {
      sanitized.authenticated = config.authenticated;
    }

    if (config.cacheEnabled !== undefined) {
      sanitized.cacheEnabled = config.cacheEnabled;
    }

    if (config.cacheTTL !== undefined) {
      sanitized.cacheTTL = Math.max(0, config.cacheTTL);
    }

    if (config.enableProgress !== undefined) {
      sanitized.enableProgress = config.enableProgress;
    }

    if (config.maxMemoryMB !== undefined) {
      sanitized.maxMemoryMB = Math.max(512, config.maxMemoryMB);
    }

    return sanitized;
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(configString: string): void {
    try {
      const config = JSON.parse(configString);
      this.setConfig(config);
    } catch (error) {
      logger.error('Failed to import configuration:', error);
      throw new Error('Invalid configuration JSON');
    }
  }
}

export const configManager = ConfigManager.getInstance();
