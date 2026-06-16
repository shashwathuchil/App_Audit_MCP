import os from 'os';
import logger from './logger.js';

export interface ResourceLimits {
  maxConcurrency: number;
  maxMemoryMB: number;
  maxCpuUsage: number;
}

export class ResourceManager {
  private static instance: ResourceManager;
  private limits: ResourceLimits;
  private currentUsage: { memory: number; cpu: number } = { memory: 0, cpu: 0 };

  private constructor() {
    this.limits = this.calculateOptimalLimits();
  }

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  private calculateOptimalLimits(): ResourceLimits {
    const totalMemory = os.totalmem();
    const cpuCount = os.cpus().length;
    const freeMemory = os.freemem();

    // Use 70% of available memory for the application
    const maxMemoryMB = Math.floor((freeMemory * 0.7) / (1024 * 1024));
    
    // Use 50% of CPU cores for concurrency
    const maxConcurrency = Math.max(1, Math.floor(cpuCount * 0.5));
    
    // Limit CPU usage to 80%
    const maxCpuUsage = 0.8;

    logger.info(`Resource limits calculated:`, {
      maxConcurrency,
      maxMemoryMB,
      maxCpuUsage,
      totalMemoryMB: Math.floor(totalMemory / (1024 * 1024)),
      cpuCount,
    });

    return {
      maxConcurrency,
      maxMemoryMB,
      maxCpuUsage,
    };
  }

  getLimits(): ResourceLimits {
    return { ...this.limits };
  }

  setConcurrency(concurrency: number): void {
    this.limits.maxConcurrency = Math.max(1, Math.min(concurrency, os.cpus().length));
    logger.info(`Concurrency set to ${this.limits.maxConcurrency}`);
  }

  setMemoryLimit(memoryMB: number): void {
    const totalMemoryMB = Math.floor(os.totalmem() / (1024 * 1024));
    this.limits.maxMemoryMB = Math.max(512, Math.min(memoryMB, totalMemoryMB));
    logger.info(`Memory limit set to ${this.limits.maxMemoryMB}MB`);
  }

  canAllocateTask(): boolean {
    const memoryUsage = process.memoryUsage();
    const usedMemoryMB = memoryUsage.heapUsed / (1024 * 1024);
    
    return usedMemoryMB < this.limits.maxMemoryMB;
  }

  getAvailableSlots(): number {
    const memoryUsage = process.memoryUsage();
    const usedMemoryMB = memoryUsage.heapUsed / (1024 * 1024);
    const availableMemoryMB = this.limits.maxMemoryMB - usedMemoryMB;
    
    // Estimate each task uses ~200MB
    const memorySlots = Math.floor(availableMemoryMB / 200);
    
    return Math.min(this.limits.maxConcurrency, Math.max(1, memorySlots));
  }

  getCurrentUsage(): { memory: number; cpu: number; memoryPercent: number } {
    const memoryUsage = process.memoryUsage();
    const usedMemoryMB = memoryUsage.heapUsed / (1024 * 1024);
    const totalMemoryMB = os.totalmem() / (1024 * 1024);
    
    return {
      memory: usedMemoryMB,
      cpu: this.currentUsage.cpu,
      memoryPercent: (usedMemoryMB / totalMemoryMB) * 100,
    };
  }

  updateCpuUsage(cpuUsage: number): void {
    this.currentUsage.cpu = cpuUsage;
  }

  getSystemInfo(): {
    platform: string;
    arch: string;
    cpuCount: number;
    totalMemoryMB: number;
    freeMemoryMB: number;
  } {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      totalMemoryMB: Math.floor(os.totalmem() / (1024 * 1024)),
      freeMemoryMB: Math.floor(os.freemem() / (1024 * 1024)),
    };
  }

  shouldThrottle(): boolean {
    const usage = this.getCurrentUsage();
    return usage.memoryPercent > 80 || this.currentUsage.cpu > this.limits.maxCpuUsage;
  }

  getRecommendedConcurrency(): number {
    const availableSlots = this.getAvailableSlots();
    
    if (this.shouldThrottle()) {
      return Math.max(1, Math.floor(availableSlots * 0.5));
    }
    
    return availableSlots;
  }
}
