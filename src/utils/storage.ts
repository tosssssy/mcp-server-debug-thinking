import fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as readline from 'readline';
import path from 'path';
import { logger } from './logger.js';

export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    logger.error(`Failed to create directory ${dirPath}:`, error);
    throw error;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return null;
    }
    logger.error(`Failed to read JSON file ${filePath}:`, error);
    throw error;
  }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error(`Failed to write JSON file ${filePath}:`, error);
    throw error;
  }
}

export async function listJsonFiles(dirPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dirPath);
    return files.filter(f => f.endsWith('.json'));
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return [];
    }
    logger.error(`Failed to list files in ${dirPath}:`, error);
    throw error;
  }
}

// JSONL operations
export async function appendJsonLine<T>(filePath: string, data: T): Promise<void> {
  try {
    const line = JSON.stringify(data) + '\n';
    await fs.appendFile(filePath, line, 'utf-8');
  } catch (error) {
    logger.error(`Failed to append to JSONL file ${filePath}:`, error);
    throw error;
  }
}

export async function readJsonLines<T>(filePath: string): Promise<T[]> {
  try {
    const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const lines: T[] = [];
    for await (const line of rl) {
      if (line.trim()) {
        try {
          lines.push(JSON.parse(line));
        } catch (parseError) {
          logger.warn(`Skipping invalid JSON line in ${filePath}: ${line}`);
        }
      }
    }
    return lines;
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return [];
    }
    logger.error(`Failed to read JSONL file ${filePath}:`, error);
    throw error;
  }
}

export async function* readJsonLinesStream<T>(filePath: string): AsyncGenerator<T> {
  try {
    const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          yield JSON.parse(line) as T;
        } catch (parseError) {
          logger.warn(`Skipping invalid JSON line in ${filePath}: ${line}`);
        }
      }
    }
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return;
    }
    logger.error(`Failed to stream JSONL file ${filePath}:`, error);
    throw error;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

