import { chromium, Browser } from '@playwright/test';
import { SecurityObservation } from '../types/index.js';
import logger from '../utils/logger.js';
import { withRetry, withTimeout } from '../utils/retry.js';

export class SecurityAuditor {
  private browser: Browser | null = null;

  async review(url: string, route?: string): Promise<SecurityObservation[]> {
    logger.info(`Running security review for ${url}`);

    const observations: SecurityObservation[] = [];

    try {
      this.browser = await chromium.launch({ headless: true });
      const context = await this.browser.newContext();
      const page = await context.newPage();

      await withRetry(
        async () => {
          await withTimeout(
            async () => page.goto(url, { waitUntil: 'networkidle' }),
            30000,
            `Page load timeout for ${url}`
          );
        },
        { retries: 3 }
      );

      const exposedSecrets = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        const secrets: string[] = [];
        const secretPatterns = [
          /api[_-]?key/i,
          /secret[_-]?key/i,
          /password/i,
          /token/i,
          /aws[_-]?access[_-]?key/i,
          /private[_-]?key/i,
        ];

        for (const script of scripts) {
          const content = script.textContent || '';
          for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
              secrets.push(script.src || 'inline script');
            }
          }
        }
        return secrets;
      });

      for (const secret of exposedSecrets) {
        observations.push({
          type: 'exposed-secret',
          description: `Potential secret exposed in JavaScript: ${secret}`,
          severity: 'high',
          url: route || url,
          location: secret,
        });
      }

      const localStorageUsage = await page.evaluate(() => {
        const items: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            items.push(key);
          }
        }
        return items;
      });

      if (localStorageUsage.length > 0) {
        observations.push({
          type: 'localStorage-usage',
          description: `Application uses localStorage (${localStorageUsage.length} items)`,
          severity: 'low',
          url: route || url,
          location: 'localStorage',
        });
      }

      const insecureCookies = await page.evaluate(() => {
        const cookies = document.cookie.split(';').filter((c) => c.trim());
        const insecure: string[] = [];

        for (const cookie of cookies) {
          if (!cookie.includes('Secure')) {
            insecure.push(cookie.trim());
          }
        }
        return insecure;
      });

      for (const cookie of insecureCookies) {
        observations.push({
          type: 'insecure-cookie',
          description: `Cookie without Secure flag: ${cookie.substring(0, 50)}...`,
          severity: 'medium',
          url: route || url,
          location: 'cookie',
        });
      }

      const mixedContent = await page.evaluate(() => {
        const resources = Array.from(document.querySelectorAll('img, script, link, iframe'));
        const mixed: string[] = [];

        for (const resource of resources) {
          const src = (resource as any).src || (resource as any).href;
          if (src && src.startsWith('http:') && window.location.protocol === 'https:') {
            mixed.push(src);
          }
        }
        return mixed;
      });

      for (const resource of mixedContent) {
        observations.push({
          type: 'mixed-content',
          description: `Mixed content detected: HTTP resource on HTTPS page`,
          severity: 'medium',
          url: route || url,
          location: resource,
        });
      }

      const cspMeta = await page.$eval('meta[http-equiv="Content-Security-Policy"]', (el: any) => el.content).catch(() => '');
      if (!cspMeta) {
        observations.push({
          type: 'missing-csp',
          description: 'Content Security Policy (CSP) header or meta tag not found',
          severity: 'medium',
          url: route || url,
        });
      }

      const httpResources = await page.evaluate(() => {
        const resources = Array.from(document.querySelectorAll('img, script, link, iframe'));
        const http: string[] = [];

        for (const resource of resources) {
          const src = (resource as any).src || (resource as any).href;
          if (src && src.startsWith('http://')) {
            http.push(src);
          }
        }
        return http;
      });

      if (httpResources.length > 0) {
        observations.push({
          type: 'http-resources',
          description: `${httpResources.length} resources loaded over HTTP (insecure)`,
          severity: 'medium',
          url: route || url,
        });
      }

      const inlineScripts = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script:not([src])'));
        return scripts.length;
      });

      if (inlineScripts > 0) {
        observations.push({
          type: 'inline-scripts',
          description: `${inlineScripts} inline scripts detected (CSP violation risk)`,
          severity: 'low',
          url: route || url,
        });
      }

      const inlineStyles = await page.evaluate(() => {
        const styles = Array.from(document.querySelectorAll('style'));
        return styles.length;
      });

      if (inlineStyles > 0) {
        observations.push({
          type: 'inline-styles',
          description: `${inlineStyles} inline style blocks detected`,
          severity: 'low',
          url: route || url,
        });
      }

      const formAction = await page.evaluate(() => {
        const forms = Array.from(document.querySelectorAll('form'));
        const insecureForms: string[] = [];

        for (const form of forms) {
          const action = (form as any).action;
          if (action && action.startsWith('http://')) {
            insecureForms.push(action);
          }
        }
        return insecureForms;
      });

      for (const action of formAction) {
        observations.push({
          type: 'insecure-form-action',
          description: `Form submits to insecure URL: ${action}`,
          severity: 'high',
          url: route || url,
          location: action,
        });
      }

      await context.close();
      await this.browser.close();

      logger.info(`Found ${observations.length} security observations`);
      return observations;
    } catch (error) {
      logger.error('Failed to run security review:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  calculateScore(observations: SecurityObservation[]): number {
    if (observations.length === 0) return 100;

    let score = 100;
    for (const obs of observations) {
      if (obs.severity === 'high') score -= 15;
      if (obs.severity === 'medium') score -= 8;
      if (obs.severity === 'low') score -= 3;
    }
    return Math.max(0, score);
  }
}
