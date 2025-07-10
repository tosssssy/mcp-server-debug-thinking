import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Logger, LogLevel, logger } from "../../utils/logger.js";
import chalk from "chalk";

describe("Logger", () => {
  let consoleErrorSpy: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    // Mock console.error
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  describe("LogLevel configuration", () => {
    it("should default to INFO level", () => {
      delete process.env.DISABLE_DEBUG_LOGGING;
      delete process.env.DEBUG_LOG_LEVEL;
      const logger = new Logger();

      logger.info("test");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should disable logging when DISABLE_DEBUG_LOGGING is true", () => {
      process.env.DISABLE_DEBUG_LOGGING = "true";
      const logger = new Logger();

      logger.info("test");
      logger.error("test");
      logger.debug("test");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should respect DEBUG_LOG_LEVEL environment variable", () => {
      process.env.DEBUG_LOG_LEVEL = "DEBUG";
      const logger = new Logger();

      logger.debug("debug message");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle invalid DEBUG_LOG_LEVEL gracefully", () => {
      delete process.env.DISABLE_DEBUG_LOGGING;
      process.env.DEBUG_LOG_LEVEL = "INVALID";
      const logger = new Logger();

      // Should fall back to INFO level
      logger.info("test");
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockClear();
      logger.debug("test");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("Logging methods", () => {
    let logger: Logger;

    beforeEach(() => {
      delete process.env.DISABLE_DEBUG_LOGGING;
      delete process.env.DEBUG_LOG_LEVEL;
      logger = new Logger();
    });

    it("should log debug messages with gray color", () => {
      process.env.DEBUG_LOG_LEVEL = "DEBUG";
      const debugLogger = new Logger();

      debugLogger.debug("debug message", { extra: "data" });
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.gray("[DEBUG] debug message"), {
        extra: "data",
      });
    });

    it("should log info messages", () => {
      logger.info("info message", "arg1", "arg2");
      expect(consoleErrorSpy).toHaveBeenCalledWith("info message", "arg1", "arg2");
    });

    it("should log warn messages with yellow color", () => {
      logger.warn("warning message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.yellow("warning message"));
    });

    it("should log error messages with red color", () => {
      logger.error("error message", new Error("test"));
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red("error message"), new Error("test"));
    });

    it("should log success messages with green color", () => {
      logger.success("success message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.green("success message"));
    });

    it("should log dim messages", () => {
      logger.dim("dim message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.dim("dim message"));
    });

    it("should log bold messages", () => {
      logger.bold("bold message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.bold("bold message"));
    });
  });

  describe("Special logging methods", () => {
    let logger: Logger;

    beforeEach(() => {
      delete process.env.DISABLE_DEBUG_LOGGING;
      logger = new Logger();
    });

    it("should log session start", () => {
      logger.session("start", "session-123");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.bold.blue("\n🚀 Started debug session: session-123\n")
      );
    });

    it("should log session end", () => {
      logger.session("end", "session-123");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.bold.red("\n🏁 Ended debug session: session-123\n")
      );
    });

    it("should log search queries and results", () => {
      const query = { pattern: "test", type: "problem" };
      logger.search(query, 5);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.cyan("🔍 Searching with query:"), query);
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.green("✓ Found 5 matches"));
    });
  });

  describe("Log level filtering", () => {
    it("should not log debug messages at INFO level", () => {
      process.env.DEBUG_LOG_LEVEL = "INFO";
      const logger = new Logger();

      logger.debug("should not appear");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should not log info messages at WARN level", () => {
      process.env.DEBUG_LOG_LEVEL = "WARN";
      const logger = new Logger();

      logger.info("should not appear");
      logger.debug("should not appear");
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      logger.warn("should appear");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should only log errors at ERROR level", () => {
      process.env.DEBUG_LOG_LEVEL = "ERROR";
      const logger = new Logger();

      logger.info("should not appear");
      logger.warn("should not appear");
      logger.debug("should not appear");
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      logger.error("should appear");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should not log anything at NONE level", () => {
      process.env.DEBUG_LOG_LEVEL = "NONE";
      const logger = new Logger();

      logger.debug("no");
      logger.info("no");
      logger.warn("no");
      logger.error("no");
      logger.success("no");
      logger.dim("no");
      logger.bold("no");
      logger.session("start", "no");
      logger.search({}, 0);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("Singleton logger instance", () => {
    it("should export a logger instance", () => {
      expect(logger).toBeInstanceOf(Logger);
    });
  });
});
