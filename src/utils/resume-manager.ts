import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import logger from './logger.js';
import { ensureDirectories } from './storage.js';

export interface ResumeState {
  auditId: string;
  timestamp: Date;
  config: any;
  completedRoutes: string[];
  failedRoutes: string[];
  pendingRoutes: string[];
  progress: {
    current: number;
    total: number;
  };
  partialResults: any;
}

export class ResumeManager {
  private static instance: ResumeManager;
  private stateDir: string;
  private currentState: ResumeState | null = null;

  private constructor() {
    this.stateDir = join(process.cwd(), '.audit-state');
  }

  static getInstance(): ResumeManager {
    if (!ResumeManager.instance) {
      ResumeManager.instance = new ResumeManager();
    }
    return ResumeManager.instance;
  }

  async initialize(auditId: string, config: any, routes: string[]): Promise<void> {
    await ensureDirectories();
    
    this.currentState = {
      auditId,
      timestamp: new Date(),
      config,
      completedRoutes: [],
      failedRoutes: [],
      pendingRoutes: routes,
      progress: {
        current: 0,
        total: routes.length,
      },
      partialResults: {
        consoleLogs: [],
        networkIssues: [],
        accessibilityIssues: [],
        performanceMetrics: [],
        performanceIssues: [],
        uiIssues: [],
        seoIssues: [],
        securityObservations: [],
        screenshots: [],
      },
    };

    await this.saveState();
    logger.info(`Resume state initialized for audit ${auditId}`);
  }

  async saveState(): Promise<void> {
    if (!this.currentState) {
      logger.warn('No state to save');
      return;
    }

    try {
      const stateFile = join(this.stateDir, `${this.currentState.auditId}.json`);
      writeFileSync(stateFile, JSON.stringify(this.currentState, null, 2));
      logger.debug(`State saved for audit ${this.currentState.auditId}`);
    } catch (error) {
      logger.error('Failed to save resume state:', error);
    }
  }

  async loadState(auditId: string): Promise<ResumeState | null> {
    try {
      const stateFile = join(this.stateDir, `${auditId}.json`);
      
      if (!existsSync(stateFile)) {
        logger.info(`No resume state found for audit ${auditId}`);
        return null;
      }

      const stateData = readFileSync(stateFile, 'utf-8');
      this.currentState = JSON.parse(stateData);
      if (this.currentState && this.currentState.timestamp) {
        this.currentState.timestamp = new Date(this.currentState.timestamp);
      }
      
      logger.info(`Resume state loaded for audit ${auditId}`);
      return this.currentState;
    } catch (error) {
      logger.error('Failed to load resume state:', error);
      return null;
    }
  }

  markRouteCompleted(route: string, results: any): void {
    if (!this.currentState) return;

    this.currentState.completedRoutes.push(route);
    this.currentState.pendingRoutes = this.currentState.pendingRoutes.filter(r => r !== route);
    this.currentState.progress.current = this.currentState.completedRoutes.length;

    // Merge partial results
    if (results.consoleLogs) {
      this.currentState.partialResults.consoleLogs.push(...results.consoleLogs);
    }
    if (results.networkIssues) {
      this.currentState.partialResults.networkIssues.push(...results.networkIssues);
    }
    if (results.accessibilityIssues) {
      this.currentState.partialResults.accessibilityIssues.push(...results.accessibilityIssues);
    }
    if (results.performanceMetrics) {
      this.currentState.partialResults.performanceMetrics.push(results.performanceMetrics);
    }
    if (results.performanceIssues) {
      this.currentState.partialResults.performanceIssues.push(...results.performanceIssues);
    }
    if (results.uiIssues) {
      this.currentState.partialResults.uiIssues.push(...results.uiIssues);
    }
    if (results.seoIssues) {
      this.currentState.partialResults.seoIssues.push(...results.seoIssues);
    }
    if (results.securityObservations) {
      this.currentState.partialResults.securityObservations.push(...results.securityObservations);
    }
    if (results.screenshots) {
      this.currentState.partialResults.screenshots.push(...results.screenshots);
    }

    this.saveState();
  }

  markRouteFailed(route: string, error: Error): void {
    if (!this.currentState) return;

    this.currentState.failedRoutes.push(route);
    this.currentState.pendingRoutes = this.currentState.pendingRoutes.filter(r => r !== route);
    this.currentState.progress.current = this.currentState.completedRoutes.length;

    logger.warn(`Route marked as failed: ${route}`, error.message);
    this.saveState();
  }

  getPendingRoutes(): string[] {
    return this.currentState?.pendingRoutes || [];
  }

  getCompletedRoutes(): string[] {
    return this.currentState?.completedRoutes || [];
  }

  getFailedRoutes(): string[] {
    return this.currentState?.failedRoutes || [];
  }

  getPartialResults(): any {
    return this.currentState?.partialResults || {};
  }

  getProgress(): { current: number; total: number; percentage: number } {
    if (!this.currentState) {
      return { current: 0, total: 0, percentage: 0 };
    }

    const total = this.currentState.progress.total || 0;
    const current = this.currentState.progress.current || 0;
    const percentage = total > 0 ? (current / total) * 100 : 0;

    return {
      current,
      total,
      percentage,
    };
  }

  canResume(auditId: string): boolean {
    const stateFile = join(this.stateDir, `${auditId}.json`);
    return existsSync(stateFile);
  }

  async clearState(auditId: string): Promise<void> {
    try {
      const stateFile = join(this.stateDir, `${auditId}.json`);
      
      if (existsSync(stateFile)) {
        // In a real implementation, we would delete the file
        // For now, we'll just log
        logger.info(`State cleared for audit ${auditId}`);
      }
      
      this.currentState = null;
    } catch (error) {
      logger.error('Failed to clear resume state:', error);
    }
  }

  async cleanupOldStates(maxAgeHours: number = 24): Promise<void> {
    // In a real implementation, we would scan the state directory
    // and delete states older than maxAgeHours
    logger.info(`Cleanup of old states (max age: ${maxAgeHours}h)`);
  }

  getCurrentState(): ResumeState | null {
    return this.currentState;
  }

  isComplete(): boolean {
    return this.currentState?.pendingRoutes.length === 0;
  }
}

export const resumeManager = ResumeManager.getInstance();
