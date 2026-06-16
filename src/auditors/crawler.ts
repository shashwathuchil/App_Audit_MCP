import { chromium, Page, Browser } from '@playwright/test';
import { URL } from 'url';
import logger from '../utils/logger.js';
import { SiteMap, Route, Form, Button, Link, Menu, Modal, AuthCredentials } from '../types/index.js';
import { withRetry, withTimeout } from '../utils/retry.js';

export class Crawler {
  private browser: Browser | null = null;
  private visitedUrls: Set<string> = new Set();
  private queue: Route[] = [];

  async crawl(
    url: string,
    depth: number = 5,
    maxRoutes: number = 50,
    authenticated: boolean = false,
    authCredentials?: AuthCredentials
  ): Promise<SiteMap> {
    logger.info(`Starting crawl of ${url} with depth ${depth}`);

    const siteMap: SiteMap = {
      baseUrl: url,
      routes: [],
      forms: [],
      buttons: [],
      links: [],
      menus: [],
      modals: [],
    };

    try {
      this.browser = await chromium.launch({ headless: true });
      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
      });

      if (authenticated && authCredentials) {
        await this.authenticate(context, url, authCredentials);
      }

      const page = await context.newPage();
      
      this.queue.push({
        url,
        depth: 0,
        type: 'page',
      });

      while (this.queue.length > 0 && siteMap.routes.length < maxRoutes) {
        const currentRoute = this.queue.shift()!;
        
        if (this.visitedUrls.has(currentRoute.url)) {
          continue;
        }

        if (currentRoute.depth > depth) {
          continue;
        }

        try {
          const routeData = await this.crawlRoute(page, currentRoute);
          siteMap.routes.push(routeData);

          const pageData = await this.extractPageData(page, currentRoute.url);
          siteMap.forms.push(...pageData.forms);
          siteMap.buttons.push(...pageData.buttons);
          siteMap.links.push(...pageData.links);
          siteMap.menus.push(...pageData.menus);
          siteMap.modals.push(...pageData.modals);

          this.visitedUrls.add(currentRoute.url);
          logger.info(`Crawled ${currentRoute.url} (${siteMap.routes.length}/${maxRoutes})`);
        } catch (error) {
          logger.error(`Failed to crawl ${currentRoute.url}:`, error);
        }
      }

      await context.close();
      await this.browser.close();
      
      logger.info(`Crawl completed. Found ${siteMap.routes.length} routes`);
      return siteMap;
    } catch (error) {
      logger.error('Crawl failed:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  private async authenticate(
    context: any,
    _url: string,
    credentials: AuthCredentials
  ): Promise<void> {
    if (!credentials.loginUrl) {
      logger.warn('Authentication requested but no login URL provided');
      return;
    }

    const page = await context.newPage();
    
    try {
      await withTimeout(
        page.goto(credentials.loginUrl),
        30000,
        'Login page load timeout'
      );

      if (credentials.loginSelectors?.usernameField) {
        await page.fill(credentials.loginSelectors.usernameField, credentials.username || '');
      }

      if (credentials.loginSelectors?.passwordField) {
        await page.fill(credentials.loginSelectors.passwordField, credentials.password || '');
      }

      if (credentials.loginSelectors?.submitButton) {
        await page.click(credentials.loginSelectors.submitButton);
      }

      await page.waitForLoadState('networkidle');
      logger.info('Authentication successful');
    } catch (error) {
      logger.error('Authentication failed:', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  private async crawlRoute(page: Page, route: Route): Promise<Route> {
    await withRetry(
      async () => {
        await withTimeout(
          async () => page.goto(route.url, { waitUntil: 'networkidle' }),
          30000,
          `Page load timeout for ${route.url}`
        );
      },
      { retries: 3 }
    );

    const title = await page.title();
    
    const links = await page.$$eval('a[href]', (anchors) =>
      anchors
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((href) => href && !href.startsWith('javascript:') && !href.startsWith('#'))
    );

    for (const link of links) {
      if (this.isInternalLink(route.url, link) && !this.visitedUrls.has(link)) {
        this.queue.push({
          url: link,
          depth: route.depth + 1,
          parentUrl: route.url,
          type: 'page',
        });
      }
    }

    return {
      ...route,
      title,
    };
  }

  private async extractPageData(page: Page, url: string) {
    const forms = await this.extractForms(page, url);
    const buttons = await this.extractButtons(page, url);
    const links = await this.extractLinks(page, url);
    const menus = await this.extractMenus(page, url);
    const modals = await this.extractModals(page, url);
    return { forms, buttons, links, menus, modals };
  }

  private async extractForms(page: Page, url: string): Promise<Form[]> {
    const forms: Form[] = [];
    const formElements = await page.$$('form');

    for (const form of formElements) {
      try {
        const action = await form.getAttribute('action');
        const method = await form.getAttribute('method') || 'GET';
        const fields = await form.$$eval('input, select, textarea', (inputs) =>
          inputs.map((input) => ({
            name: (input as any).name || (input as any).id || '',
            type: (input as any).type || 'text',
            required: (input as any).required || false,
            selector: '',
          }))
        );

        forms.push({
          url,
          action: action || url,
          method: method.toUpperCase(),
          fields,
          selector: await form.evaluate((el) => {
            const path: string[] = [];
            let current = el;
            while (current && current !== document.body) {
              const tag = current.tagName.toLowerCase();
              const id = current.id ? `#${current.id}` : '';
              const classes = current.className ? `.${current.className.split(' ').join('.')}` : '';
              path.unshift(`${tag}${id}${classes}`);
              current = current.parentElement!;
            }
            return path.join(' > ');
          }),
        });
      } catch (error) {
        logger.warn('Failed to extract form:', error);
      }
    }

    return forms;
  }

  private async extractButtons(page: Page, _url: string): Promise<Button[]> {
    const buttons: Button[] = [];
    const buttonElements = await page.$$('button, input[type="submit"], input[type="button"], a[role="button"]');

    for (const button of buttonElements) {
      try {
        const text = await button.textContent();
        const href = await button.getAttribute('href');
        
        buttons.push({
          text: text?.trim() || '',
          url: href || _url,
          selector: await button.evaluate((el) => {
            const path: string[] = [];
            let current = el;
            while (current && current !== document.body) {
              const tag = current.tagName.toLowerCase();
              const id = current.id ? `#${current.id}` : '';
              path.unshift(`${tag}${id}`);
              current = current.parentElement!;
            }
            return path.join(' > ');
          }),
          type: href ? 'link' : 'button',
        });
      } catch (error) {
        logger.warn('Failed to extract button:', error);
      }
    }

    return buttons;
  }

  private async extractLinks(page: Page, _url: string): Promise<Link[]> {
    const links: Link[] = [];
    const anchors = await page.$$('a[href]');

    for (const anchor of anchors) {
      try {
        const href = await anchor.getAttribute('href');
        const text = await anchor.textContent();
        
        if (href) {
          links.push({
            text: text?.trim() || '',
            url: href,
            selector: await anchor.evaluate((el: any) => {
              const path: string[] = [];
              let current = el;
              while (current && current !== document.body) {
                const tag = current.tagName.toLowerCase();
                const id = current.id ? `#${current.id}` : '';
                path.unshift(`${tag}${id}`);
                current = current.parentElement!;
              }
              return path.join(' > ');
            }),
            internal: this.isInternalLink(_url, href),
          });
        }
      } catch (error) {
        logger.warn('Failed to extract link:', error);
      }
    }

    return links;
  }

  private async extractMenus(page: Page, _url: string): Promise<Menu[]> {
    const menus: Menu[] = [];
    const navElements = await page.$$('nav, [role="navigation"], .menu, .navbar');

    for (const nav of navElements) {
      try {
        const name = await nav.getAttribute('aria-label') || await nav.getAttribute('class') || 'Navigation';
        const items = await nav.$$eval('a', (anchors) =>
          anchors.map((a: any) => ({
            text: a.textContent?.trim() || '',
            url: a.href || '',
            selector: '',
          }))
        );

        menus.push({
          name,
          items,
          selector: await nav.evaluate((el) => {
            const path: string[] = [];
            let current = el;
            while (current && current !== document.body) {
              const tag = current.tagName.toLowerCase();
              const id = current.id ? `#${current.id}` : '';
              path.unshift(`${tag}${id}`);
              current = current.parentElement!;
            }
            return path.join(' > ');
          }),
        });
      } catch (error) {
        logger.warn('Failed to extract menu:', error);
      }
    }

    return menus;
  }

  private async extractModals(page: Page, _url: string): Promise<Modal[]> {
    const modals: Modal[] = [];
    const modalElements = await page.$$('[role="dialog"], .modal, .dialog, [data-modal]');

    for (const modal of modalElements) {
      try {
        const name = await modal.getAttribute('aria-label') || await modal.getAttribute('id') || 'Modal';
        const trigger = await modal.getAttribute('data-trigger') || '';
        
        modals.push({
          name,
          trigger,
          selector: await modal.evaluate((el) => {
            const path: string[] = [];
            let current = el;
            while (current && current !== document.body) {
              const tag = current.tagName.toLowerCase();
              const id = current.id ? `#${current.id}` : '';
              path.unshift(`${tag}${id}`);
              current = current.parentElement!;
            }
            return path.join(' > ');
          }),
        });
      } catch (error) {
        logger.warn('Failed to extract modal:', error);
      }
    }

    return modals;
  }

  private isInternalLink(baseUrl: string, linkUrl: string): boolean {
    try {
      const base = new URL(baseUrl);
      const link = new URL(linkUrl);
      return base.hostname === link.hostname;
    } catch {
      return false;
    }
  }
}
