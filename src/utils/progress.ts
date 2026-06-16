import { EventEmitter } from 'events';

export interface ProgressUpdate {
  stage: string;
  current: number;
  total: number;
  message: string;
  timestamp: Date;
}

export class ProgressTracker extends EventEmitter {
  private stages: Map<string, { current: number; total: number }> = new Map();
  private startTime: Date = new Date();

  setStage(stage: string, total: number): void {
    this.stages.set(stage, { current: 0, total });
    this.emit('stage', stage);
  }

  updateProgress(stage: string, increment: number = 1): void {
    const stageData = this.stages.get(stage);
    if (stageData) {
      stageData.current = Math.min(stageData.current + increment, stageData.total);
      
      const update: ProgressUpdate = {
        stage,
        current: stageData.current,
        total: stageData.total,
        message: `${stage}: ${stageData.current}/${stageData.total}`,
        timestamp: new Date(),
      };
      
      this.emit('progress', update);
    }
  }

  completeStage(stage: string): void {
    const stageData = this.stages.get(stage);
    if (stageData) {
      stageData.current = stageData.total;
      this.emit('progress', {
        stage,
        current: stageData.total,
        total: stageData.total,
        message: `${stage} completed`,
        timestamp: new Date(),
      });
    }
  }

  getProgress(stage: string): { current: number; total: number; percentage: number } {
    const stageData = this.stages.get(stage);
    if (!stageData) {
      return { current: 0, total: 0, percentage: 0 };
    }
    return {
      current: stageData.current,
      total: stageData.total,
      percentage: stageData.total > 0 ? (stageData.current / stageData.total) * 100 : 0,
    };
  }

  getOverallProgress(): { current: number; total: number; percentage: number; elapsed: number } {
    let current = 0;
    let total = 0;

    for (const stageData of this.stages.values()) {
      current += stageData.current;
      total += stageData.total;
    }

    const elapsed = Date.now() - this.startTime.getTime();
    
    return {
      current,
      total,
      percentage: total > 0 ? (current / total) * 100 : 0,
      elapsed,
    };
  }

  reset(): void {
    this.stages.clear();
    this.startTime = new Date();
    this.emit('reset');
  }

  getETA(): number {
    const overall = this.getOverallProgress();
    if (overall.percentage === 0) {
      return 0;
    }
    const rate = overall.elapsed / overall.percentage;
    return Math.round(rate * (100 - overall.percentage));
  }
}
