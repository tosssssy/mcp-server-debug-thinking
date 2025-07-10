import { vi, beforeEach, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";

// Mock environment variables
process.env.DEBUG_DATA_DIR = path.join(__dirname, "test-data");
process.env.DISABLE_DEBUG_LOGGING = "true";

// Clean up test data directory before each test
beforeEach(async () => {
  const testDataDir = path.join(__dirname, "test-data");
  try {
    await fs.rm(testDataDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, which is fine
  }
});

// Clean up after all tests
afterAll(async () => {
  const testDataDir = path.join(__dirname, "test-data");
  try {
    await fs.rm(testDataDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, which is fine
  }
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};
