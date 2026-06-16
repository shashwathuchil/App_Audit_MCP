import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, '../..');
const REPORTS_DIR = path.join(BASE_DIR, 'reports');
const SCREENSHOTS_DIR = path.join(REPORTS_DIR, 'screenshots');
const LOGS_DIR = path.join(REPORTS_DIR, 'logs');
const NETWORK_DIR = path.join(REPORTS_DIR, 'network');
const TRACES_DIR = path.join(REPORTS_DIR, 'traces');

export async function ensureDirectories(): Promise<void> {
  const dirs = [REPORTS_DIR, SCREENSHOTS_DIR, LOGS_DIR, NETWORK_DIR, TRACES_DIR];
  
  for (const dir of dirs) {
    try {
      await fs.ensureDir(dir);
      logger.debug(`Ensured directory exists: ${dir}`);
    } catch (error) {
      logger.error(`Failed to create directory ${dir}:`, error);
      throw error;
    }
  }
}

export async function saveScreenshot(
  buffer: Buffer,
  filename: string
): Promise<string> {
  await ensureDirectories();
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await fs.writeFile(filepath, buffer);
  logger.debug(`Saved screenshot: ${filepath}`);
  return filepath;
}

export async function saveNetworkData(
  data: any,
  filename: string
): Promise<string> {
  await ensureDirectories();
  const filepath = path.join(NETWORK_DIR, filename);
  await fs.writeJson(filepath, data, { spaces: 2 });
  logger.debug(`Saved network data: ${filepath}`);
  return filepath;
}

export async function saveTraceData(
  data: any,
  filename: string
): Promise<string> {
  await ensureDirectories();
  const filepath = path.join(TRACES_DIR, filename);
  await fs.writeJson(filepath, data);
  logger.debug(`Saved trace data: ${filepath}`);
  return filepath;
}

export async function saveReport(
  content: string,
  filename: string,
  subDir: string = ''
): Promise<string> {
  await ensureDirectories();
  const dir = subDir ? path.join(REPORTS_DIR, subDir) : REPORTS_DIR;
  await fs.ensureDir(dir);
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, content);
  logger.debug(`Saved report: ${filepath}`);
  return filepath;
}

export async function saveJSON(data: any, filename: string): Promise<string> {
  await ensureDirectories();
  const filepath = path.join(REPORTS_DIR, filename);
  await fs.writeJson(filepath, data, { spaces: 2 });
  logger.debug(`Saved JSON report: ${filepath}`);
  return filepath;
}

export async function readJSON(filename: string): Promise<any> {
  const filepath = path.join(REPORTS_DIR, filename);
  return fs.readJson(filepath);
}

export function getRelativePath(absolutePath: string): string {
  return path.relative(BASE_DIR, absolutePath);
}

export { REPORTS_DIR, SCREENSHOTS_DIR, LOGS_DIR, NETWORK_DIR, TRACES_DIR };
