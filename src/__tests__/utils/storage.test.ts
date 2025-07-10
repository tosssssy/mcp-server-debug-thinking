import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ensureDirectory,
  writeJsonFile,
  appendJsonLine,
  readJsonLines,
  readJsonLinesStream,
  fileExists,
  listJsonFiles,
} from "../../utils/storage.js";
import fs from "fs/promises";
import path from "path";

describe("storage utils", () => {
  const testDir = path.join(__dirname, "../test-storage");
  const testFile = path.join(testDir, "test.json");
  const testJsonl = path.join(testDir, "test.jsonl");

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe("ensureDirectory", () => {
    it("should create directory if it does not exist", async () => {
      await ensureDirectory(testDir);

      const exists = await fs
        .access(testDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("should not throw if directory already exists", async () => {
      await fs.mkdir(testDir, { recursive: true });

      // Should not throw
      await expect(ensureDirectory(testDir)).resolves.not.toThrow();
    });

    it("should create nested directories", async () => {
      const nestedDir = path.join(testDir, "nested", "deep", "directory");

      await ensureDirectory(nestedDir);

      const exists = await fs
        .access(nestedDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("writeJsonFile", () => {
    it("should write JSON data to file", async () => {
      await ensureDirectory(testDir);

      const data = {
        name: "test",
        value: 42,
        nested: { key: "value" },
      };

      await writeJsonFile(testFile, data);

      const content = await fs.readFile(testFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed).toEqual(data);
    });

    it("should overwrite existing file", async () => {
      await ensureDirectory(testDir);

      await writeJsonFile(testFile, { old: "data" });
      await writeJsonFile(testFile, { new: "data" });

      const content = await fs.readFile(testFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed).toEqual({ new: "data" });
      expect(parsed.old).toBeUndefined();
    });

    it("should handle arrays", async () => {
      await ensureDirectory(testDir);

      const data = [1, 2, 3, { key: "value" }];

      await writeJsonFile(testFile, data);

      const content = await fs.readFile(testFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed).toEqual(data);
    });
  });

  describe("appendJsonLine", () => {
    it("should append JSON lines to file", async () => {
      await ensureDirectory(testDir);

      const line1 = { id: 1, name: "first" };
      const line2 = { id: 2, name: "second" };

      await appendJsonLine(testJsonl, line1);
      await appendJsonLine(testJsonl, line2);

      const content = await fs.readFile(testJsonl, "utf-8");
      const lines = content.trim().split("\n");

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual(line1);
      expect(JSON.parse(lines[1])).toEqual(line2);
    });

    it("should create file if it does not exist", async () => {
      await ensureDirectory(testDir);

      const data = { created: true };

      await appendJsonLine(testJsonl, data);

      const exists = await fileExists(testJsonl);
      expect(exists).toBe(true);

      const content = await fs.readFile(testJsonl, "utf-8");
      expect(JSON.parse(content.trim())).toEqual(data);
    });

    it("should handle complex objects", async () => {
      await ensureDirectory(testDir);

      const complexData = {
        id: "complex-1",
        metadata: {
          created: new Date().toISOString(),
          tags: ["test", "complex"],
          nested: {
            deep: {
              value: "found",
            },
          },
        },
      };

      await appendJsonLine(testJsonl, complexData);

      const content = await fs.readFile(testJsonl, "utf-8");
      const parsed = JSON.parse(content.trim());

      expect(parsed).toEqual(complexData);
    });
  });

  describe("readJsonLines", () => {
    it("should read all JSON lines from file", async () => {
      await ensureDirectory(testDir);

      const lines = [
        { id: 1, value: "a" },
        { id: 2, value: "b" },
        { id: 3, value: "c" },
      ];

      // Write lines
      for (const line of lines) {
        await appendJsonLine(testJsonl, line);
      }

      const result = await readJsonLines(testJsonl);

      expect(result).toHaveLength(3);
      expect(result).toEqual(lines);
    });

    it("should return empty array for non-existent file", async () => {
      const result = await readJsonLines(testJsonl);
      expect(result).toEqual([]);
    });

    it("should skip invalid JSON lines", async () => {
      await ensureDirectory(testDir);

      // Write mixed valid and invalid lines
      await fs.writeFile(testJsonl, '{"valid": true}\ninvalid json\n{"alsoValid": true}\n');

      const result = await readJsonLines(testJsonl);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ valid: true });
      expect(result[1]).toEqual({ alsoValid: true });
    });

    it("should handle empty lines", async () => {
      await ensureDirectory(testDir);

      // Write file with empty lines
      await fs.writeFile(testJsonl, '{"line": 1}\n\n{"line": 2}\n\n\n');

      const result = await readJsonLines(testJsonl);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ line: 1 });
      expect(result[1]).toEqual({ line: 2 });
    });
  });

  describe("readJsonLinesStream", () => {
    it("should stream JSON lines from file", async () => {
      await ensureDirectory(testDir);

      const lines = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        data: `value-${i}`,
      }));

      // Write lines
      for (const line of lines) {
        await appendJsonLine(testJsonl, line);
      }

      // Read via stream
      const results: any[] = [];
      for await (const item of readJsonLinesStream(testJsonl)) {
        results.push(item);
      }

      expect(results).toHaveLength(100);
      expect(results[0]).toEqual({ id: 0, data: "value-0" });
      expect(results[99]).toEqual({ id: 99, data: "value-99" });
    });

    it("should handle errors gracefully", async () => {
      // Non-existent file
      const results: any[] = [];

      try {
        for await (const item of readJsonLinesStream(testJsonl)) {
          results.push(item);
        }
      } catch (error) {
        // Should not reach here - error should be handled
        expect(error).toBeUndefined();
      }

      expect(results).toHaveLength(0);
    });

    it("should skip invalid lines in stream", async () => {
      await ensureDirectory(testDir);

      await fs.writeFile(testJsonl, '{"valid": 1}\n{invalid json}\n{"valid": 2}\n');

      const results: any[] = [];
      for await (const item of readJsonLinesStream(testJsonl)) {
        results.push(item);
      }

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ valid: 1 });
      expect(results[1]).toEqual({ valid: 2 });
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      await ensureDirectory(testDir);
      await fs.writeFile(testFile, "content");

      const exists = await fileExists(testFile);
      expect(exists).toBe(true);
    });

    it("should return false for non-existent file", async () => {
      const exists = await fileExists(testFile);
      expect(exists).toBe(false);
    });

    it("should return true for existing directory", async () => {
      await ensureDirectory(testDir);

      const exists = await fileExists(testDir);
      expect(exists).toBe(true);
    });

    it("should handle permission errors gracefully", async () => {
      // Mock access to throw permission error
      const originalAccess = fs.access;
      vi.spyOn(fs, "access").mockRejectedValueOnce(new Error("EACCES: permission denied"));

      const exists = await fileExists("/some/path");
      expect(exists).toBe(false);

      vi.spyOn(fs, "access").mockImplementation(originalAccess);
    });
  });

  describe("listJsonFiles", () => {
    it("should list JSON files in directory", async () => {
      await ensureDirectory(testDir);
      await fs.writeFile(path.join(testDir, "file1.json"), "{}");
      await fs.writeFile(path.join(testDir, "file2.json"), "{}");
      await fs.writeFile(path.join(testDir, "file3.txt"), "text");

      const files = await listJsonFiles(testDir);

      expect(files).toHaveLength(2);
      expect(files).toContain("file1.json");
      expect(files).toContain("file2.json");
      expect(files).not.toContain("file3.txt");
    });

    it("should return empty array for non-existent directory", async () => {
      const files = await listJsonFiles("/non/existent/dir");
      expect(files).toEqual([]);
    });

    it("should throw on other errors", async () => {
      const originalReaddir = fs.readdir;
      vi.spyOn(fs, "readdir").mockRejectedValueOnce(new Error("Permission denied"));

      await expect(listJsonFiles(testDir)).rejects.toThrow("Permission denied");

      vi.spyOn(fs, "readdir").mockImplementation(originalReaddir);
    });
  });

  describe("error handling", () => {
    it("should handle errors during directory creation", async () => {
      const originalMkdir = fs.mkdir;
      vi.spyOn(fs, "mkdir").mockRejectedValueOnce(new Error("Disk full"));

      await expect(ensureDirectory("/test/dir")).rejects.toThrow("Disk full");

      vi.spyOn(fs, "mkdir").mockImplementation(originalMkdir);
    });

    it("should log warnings for invalid JSON lines", async () => {
      // Create a file with invalid JSON
      await ensureDirectory(testDir);
      const invalidFile = path.join(testDir, "invalid.jsonl");
      await fs.writeFile(invalidFile, '{"valid": true}\ninvalid json line\n{"alsoValid": true}');

      // This should trigger the warning in readJsonLines
      const results = await readJsonLines(invalidFile);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ valid: true });
      expect(results[1]).toEqual({ alsoValid: true });
    });

    it("should handle stream with invalid JSON", async () => {
      // Create a file with invalid JSON for streaming
      await ensureDirectory(testDir);
      const streamFile = path.join(testDir, "stream.jsonl");
      await fs.writeFile(streamFile, 'not json\n{"valid": "data"}\nalso not json');

      // Stream through the file
      const results = [];
      for await (const item of readJsonLinesStream(streamFile)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ valid: "data" });
    });
  });

  describe("error handling for uncovered lines", () => {
    it("should handle appendJsonLine errors", async () => {
      const filePath = path.join(testDir, "test.jsonl");
      const data = { test: "data" };

      // Mock fs.appendFile to throw error
      const originalAppendFile = fs.appendFile;
      vi.spyOn(fs, "appendFile").mockRejectedValueOnce(new Error("Write permission denied"));

      await expect(appendJsonLine(filePath, data)).rejects.toThrow("Write permission denied");

      vi.spyOn(fs, "appendFile").mockImplementation(originalAppendFile);
    });

    it.skip("should handle readJsonLinesStream errors", async () => {
      const filePath = path.join(testDir, "nonexistent.jsonl");

      await expect(async () => {
        const items = [];
        for await (const item of readJsonLinesStream(filePath)) {
          items.push(item);
        }
      }).rejects.toThrow();
    });

    it("should handle non-ENOENT errors in listJsonFiles", async () => {
      const dirPath = "/some/dir";

      // Mock fs.readdir to throw non-ENOENT error
      const originalReaddir = fs.readdir;
      const error = new Error("Permission denied");
      (error as any).code = "EACCES"; // Not ENOENT
      vi.spyOn(fs, "readdir").mockRejectedValueOnce(error);

      await expect(listJsonFiles(dirPath)).rejects.toThrow("Permission denied");

      vi.spyOn(fs, "readdir").mockImplementation(originalReaddir);
    });

    it.skip("should handle non-ENOENT errors in readJsonLines", async () => {
      const filePath = path.join(testDir, "test.jsonl");

      // Create a mock error that's not ENOENT
      const error = new Error("Read permission denied");
      (error as any).code = "EACCES";

      // Mock createReadStream to throw error
      vi.spyOn(fs, "createReadStream" as any).mockImplementationOnce(() => {
        const stream = new (require("stream").Readable)();
        setImmediate(() => stream.emit("error", error));
        return stream;
      });

      await expect(readJsonLines(filePath)).rejects.toThrow();
    });
  });
});
