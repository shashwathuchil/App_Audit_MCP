import { chromium } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';
import { HealthStatus } from '../types/index.js';

const execAsync = promisify(exec);

export class SetupAuditor {
  async setup(options: { installBrowsers: boolean; validateDependencies: boolean }): Promise<HealthStatus> {
    const status: HealthStatus = {
      playwrightInstalled: false,
      chromeInstalled: false,
      dependenciesValid: false,
      errors: [],
      warnings: [],
    };

    try {
      if (options.installBrowsers) {
        logger.info('Installing Playwright browsers...');
        await this.installPlaywrightBrowsers();
        status.playwrightInstalled = true;
      } else {
        status.playwrightInstalled = await this.checkPlaywrightBrowsers();
      }

      status.chromeInstalled = await this.checkChrome();

      if (options.validateDependencies) {
        status.dependenciesValid = await this.validateDependencies();
      } else {
        status.dependenciesValid = true;
      }

      logger.info('Setup completed successfully', status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.errors.push(message);
      logger.error('Setup failed:', error);
    }

    return status;
  }

  private async installPlaywrightBrowsers(): Promise<void> {
    try {
      await execAsync('npx playwright install chromium');
      logger.info('Playwright Chromium installed successfully');
    } catch (error) {
      logger.error('Failed to install Playwright browsers:', error);
      throw new Error('Failed to install Playwright browsers');
    }
  }

  private async checkPlaywrightBrowsers(): Promise<boolean> {
    try {
      const browser = await chromium.launch();
      await browser.close();
      return true;
    } catch (error) {
      logger.warn('Playwright browsers not installed');
      return false;
    }
  }

  private async checkChrome(): Promise<boolean> {
    try {
      const browser = await chromium.launch({
        channel: 'chrome',
      });
      await browser.close();
      return true;
    } catch (error) {
      logger.warn('Chrome not found, will use bundled Chromium');
      return true;
    }
  }

  private async validateDependencies(): Promise<boolean> {
    const requiredPackages = [
      '@playwright/test',
      '@axe-core/playwright',
      'lighthouse',
      'axe-core',
    ];

    for (const pkg of requiredPackages) {
      try {
        await execAsync(`npm list ${pkg}`);
      } catch (error) {
        logger.warn(`Package ${pkg} not found`);
        return false;
      }
    }

    return true;
  }
}
