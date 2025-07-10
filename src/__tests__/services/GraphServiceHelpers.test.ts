import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GraphService } from "../../services/GraphService.js";
import { ActionType } from "../../types/graphActions.js";

// Test suite for the helper methods (private methods tested through reflection)
describe("GraphService - Helper Methods", () => {
  let graphService: GraphService;

  beforeEach(async () => {
    process.env.DEBUG_DATA_DIR = `.test-helpers-${Date.now()}`;
    graphService = new GraphService();
    await graphService.initialize();
  });

  afterEach(async () => {
    if (process.env.DEBUG_DATA_DIR) {
      const fs = await import("fs/promises");
      try {
        await fs.rm(process.env.DEBUG_DATA_DIR, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist
      }
      delete process.env.DEBUG_DATA_DIR;
    }
  });

  describe("findLongestCommonSubstring", () => {
    it("should find exact matches", () => {
      // @ts-ignore - accessing private method for testing
      const result = graphService.findLongestCommonSubstring("hello world", "hello world");
      expect(result).toBe("hello world");
    });

    it("should find partial matches", () => {
      // @ts-ignore - accessing private method for testing
      const result = graphService.findLongestCommonSubstring(
        "The quick brown fox jumps",
        "A quick brown fox runs"
      );
      expect(result).toBe(" quick brown fox ");
    });

    it("should handle no common substring", () => {
      // @ts-ignore - accessing private method for testing
      const result = graphService.findLongestCommonSubstring("abc", "xyz");
      expect(result).toBe("");
    });

    it("should handle empty strings", () => {
      // @ts-ignore - accessing private method for testing
      expect(graphService.findLongestCommonSubstring("", "test")).toBe("");
      // @ts-ignore
      expect(graphService.findLongestCommonSubstring("test", "")).toBe("");
      // @ts-ignore
      expect(graphService.findLongestCommonSubstring("", "")).toBe("");
    });

    it("should be case sensitive", () => {
      // @ts-ignore - accessing private method for testing
      const result = graphService.findLongestCommonSubstring("Hello", "hello");
      expect(result).toBe("ello");
    });

    it("should handle special characters", () => {
      // @ts-ignore - accessing private method for testing
      const result = graphService.findLongestCommonSubstring(
        "Error: Cannot read property 'x'",
        "Error: Cannot read property 'y'"
      );
      expect(result).toBe("Error: Cannot read property '");
    });

    it("should handle very long strings efficiently", () => {
      const longStr1 = "a".repeat(1000) + "unique" + "b".repeat(1000);
      const longStr2 = "c".repeat(1000) + "unique" + "d".repeat(1000);
      
      const startTime = Date.now();
      // @ts-ignore - accessing private method for testing
      const result = graphService.findLongestCommonSubstring(longStr1, longStr2);
      const duration = Date.now() - startTime;
      
      expect(result).toBe("unique");
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe("calculateLevenshteinSimilarity", () => {
    it("should return 1 for identical strings", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateLevenshteinSimilarity("test", "test");
      expect(similarity).toBe(1);
    });

    it("should return 0 for completely different strings", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateLevenshteinSimilarity("abc", "xyz");
      expect(similarity).toBe(0);
    });

    it("should calculate similarity for one character difference", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateLevenshteinSimilarity("test", "text");
      expect(similarity).toBeCloseTo(0.75, 2); // 3/4 characters match
    });

    it("should handle insertions", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateLevenshteinSimilarity("test", "tests");
      expect(similarity).toBe(0.8); // 4/5 = 0.8
    });

    it("should handle deletions", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateLevenshteinSimilarity("tests", "test");
      expect(similarity).toBe(0.8); // 4/5 = 0.8
    });

    it("should handle substitutions", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateLevenshteinSimilarity("kitten", "sitten");
      expect(similarity).toBeCloseTo(0.833, 2); // 5/6 characters match
    });

    it("should handle empty strings", () => {
      // @ts-ignore - accessing private method for testing
      expect(graphService.calculateLevenshteinSimilarity("", "")).toBe(1);
      // @ts-ignore
      expect(graphService.calculateLevenshteinSimilarity("test", "")).toBe(0);
      // @ts-ignore
      expect(graphService.calculateLevenshteinSimilarity("", "test")).toBe(0);
    });

    it("should be case sensitive", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateLevenshteinSimilarity("Test", "test");
      expect(similarity).toBe(0.75); // Only first character differs
    });

    it("should handle unicode characters", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateLevenshteinSimilarity("café", "cafe");
      expect(similarity).toBe(0.75); // 3/4 characters match
    });

    it("should handle very different length strings", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateLevenshteinSimilarity("a", "abcdefghij");
      expect(similarity).toBeCloseTo(0.1, 1); // 1/10 = 0.1
    });
  });

  describe("calculateWordLevelSimilarity", () => {
    it("should calculate similarity at word level", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateWordLevelSimilarity(
        "The quick brown fox",
        "The quick red fox"
      );
      expect(similarity).toBe(0.75); // 3/4 words match
    });

    it("should handle word insertions", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateWordLevelSimilarity(
        "Error in module",
        "Error in the module"
      );
      expect(similarity).toBe(0.75); // 3/4 = 0.75
    });

    it("should handle word deletions", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateWordLevelSimilarity(
        "Failed to connect to server",
        "Failed to connect server"
      );
      expect(similarity).toBe(0.8); // 4/5 = 0.8
    });

    it("should consider partial word matches", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateWordLevelSimilarity(
        "Configuration file not found",
        "Config file not found"
      );
      // "Config" and "Configuration" should be considered similar
      expect(similarity).toBeGreaterThan(0.7);
    });

    it("should handle empty strings", () => {
      // @ts-ignore - accessing private method for testing
      expect(graphService.calculateWordLevelSimilarity("", "")).toBe(1);
      // @ts-ignore
      expect(graphService.calculateWordLevelSimilarity("test", "")).toBe(0);
      // @ts-ignore
      expect(graphService.calculateWordLevelSimilarity("", "test")).toBe(0);
    });

    it("should handle single word strings", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateWordLevelSimilarity("error", "error");
      expect(similarity).toBe(1);
    });

    it("should handle punctuation correctly", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateWordLevelSimilarity(
        "Error: File not found!",
        "Error: File not found."
      );
      // Punctuation causes slight difference in word boundaries
      expect(similarity).toBeGreaterThan(0.9);
    });

    it("should handle multiple spaces", () => {
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateWordLevelSimilarity(
        "Error   in    module",
        "Error in module"
      );
      expect(similarity).toBe(1); // Extra spaces shouldn't affect similarity
    });
  });

  describe("extractErrorType", () => {
    it("should extract TypeError", () => {
      // @ts-ignore - accessing private method for testing
      const errorType = graphService.extractErrorType("TypeError: Cannot read property 'x' of undefined");
      expect(errorType).toBe("type error");
    });

    it("should extract ReferenceError", () => {
      // @ts-ignore - accessing private method for testing
      const errorType = graphService.extractErrorType("ReferenceError: x is not defined");
      expect(errorType).toBe("reference error");
    });

    it("should extract SyntaxError", () => {
      // @ts-ignore - accessing private method for testing
      const errorType = graphService.extractErrorType("SyntaxError: Unexpected token");
      expect(errorType).toBe("syntax error");
    });

    it("should extract RangeError", () => {
      // @ts-ignore - accessing private method for testing
      const errorType = graphService.extractErrorType("RangeError: Invalid array length");
      expect(errorType).toBe("range error");
    });

    it("should extract EvalError", () => {
      // @ts-ignore - accessing private method for testing
      const errorType = graphService.extractErrorType("EvalError: Code evaluation failed");
      expect(errorType).toBe("eval error");
    });

    it("should extract URIError", () => {
      // @ts-ignore - accessing private method for testing
      const errorType = graphService.extractErrorType("URIError: Malformed URI");
      expect(errorType).toBe("uri error");
    });

    it("should handle variations in formatting", () => {
      // @ts-ignore - accessing private method for testing
      expect(graphService.extractErrorType("Type Error: Something")).toBe("type error");
      // @ts-ignore
      expect(graphService.extractErrorType("type error in module")).toBe("type error");
      // @ts-ignore
      expect(graphService.extractErrorType("TYPE ERROR")).toBe("type error");
    });

    it("should return null for non-error messages", () => {
      // @ts-ignore - accessing private method for testing
      expect(graphService.extractErrorType("Warning: This is a warning")).toBe(null);
      // @ts-ignore
      expect(graphService.extractErrorType("Info: Application started")).toBe(null);
      // @ts-ignore
      expect(graphService.extractErrorType("Just a regular message")).toBe(null);
    });

    it("should handle error types in the middle of text", () => {
      // @ts-ignore - accessing private method for testing
      const errorType = graphService.extractErrorType("Application crashed with TypeError in module X");
      expect(errorType).toBe("type error");
    });

    it("should handle empty strings", () => {
      // @ts-ignore - accessing private method for testing
      const errorType = graphService.extractErrorType("");
      expect(errorType).toBe(null);
    });
  });

  describe("buildDebugPath", () => {
    it("should build a complete debug path", async () => {
      // Create a complete debugging chain
      const problemResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Test problem",
      });
      const problemId = JSON.parse(problemResult.content[0].text).nodeId;

      const hypothesisResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Test hypothesis",
        parentId: problemId,
      });
      const hypothesisId = JSON.parse(hypothesisResult.content[0].text).nodeId;

      const experimentResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Test experiment",
        parentId: hypothesisId,
      });
      const experimentId = JSON.parse(experimentResult.content[0].text).nodeId;

      const observationResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "observation",
        content: "Test observation",
        parentId: experimentId,
      });
      const observationId = JSON.parse(observationResult.content[0].text).nodeId;

      const solutionResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "solution",
        content: "Test solution",
        parentId: observationId,
      });
      const solutionId = JSON.parse(solutionResult.content[0].text).nodeId;

      // @ts-ignore - accessing private method for testing
      const path = graphService.buildDebugPath(problemId, solutionId);
      
      expect(path).toHaveLength(5);
      expect(path[0].id).toBe(problemId);
      expect(path[0].type).toBe("problem");
      expect(path[4].id).toBe(solutionId);
      expect(path[4].type).toBe("solution");
      
      // Verify the order
      expect(path[1].type).toBe("hypothesis");
      expect(path[2].type).toBe("experiment");
      expect(path[3].type).toBe("observation");
    });

    it("should handle disconnected nodes", async () => {
      const problemResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Isolated problem",
      });
      const problemId = JSON.parse(problemResult.content[0].text).nodeId;

      const solutionResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "solution",
        content: "Isolated solution",
      });
      const solutionId = JSON.parse(solutionResult.content[0].text).nodeId;

      // @ts-ignore - accessing private method for testing
      const path = graphService.buildDebugPath(problemId, solutionId);
      
      // Should at least include the solution node
      expect(path.length).toBeGreaterThanOrEqual(1);
      expect(path[path.length - 1].id).toBe(solutionId);
    });

    it("should handle circular references", async () => {
      // This test ensures the algorithm doesn't get stuck in infinite loops
      const node1Result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Node 1",
      });
      const node1Id = JSON.parse(node1Result.content[0].text).nodeId;

      const node2Result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Node 2",
      });
      const node2Id = JSON.parse(node2Result.content[0].text).nodeId;

      // Create circular reference
      await graphService.connect({
        action: ActionType.CONNECT,
        from: node1Id,
        to: node2Id,
        type: "supports",
      });

      await graphService.connect({
        action: ActionType.CONNECT,
        from: node2Id,
        to: node1Id,
        type: "supports",
      });

      // @ts-ignore - accessing private method for testing
      const path = graphService.buildDebugPath(node1Id, node2Id);
      
      // Should handle circular references without infinite loop
      expect(path).toBeDefined();
      expect(path.length).toBeGreaterThan(0);
    });

    it("should use parent index for efficient traversal", async () => {
      // Create a deep hierarchy
      let currentId: string | undefined;
      const nodeIds: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const nodeType = i === 0 ? "problem" : i === 9 ? "solution" : "hypothesis";
        const result = await graphService.create({
          action: ActionType.CREATE,
          nodeType,
          content: `Node ${i}`,
          parentId: currentId,
        });
        currentId = JSON.parse(result.content[0].text).nodeId;
        nodeIds.push(currentId);
      }

      const startTime = Date.now();
      // @ts-ignore - accessing private method for testing
      const path = graphService.buildDebugPath(nodeIds[0], nodeIds[9]);
      const duration = Date.now() - startTime;
      
      expect(path).toHaveLength(10);
      expect(duration).toBeLessThan(10); // Should be very fast with parent index
    });
  });

  describe("Error type indexing", () => {
    it("should categorize problems correctly during index build", async () => {
      // Create various problems
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "TypeError: x is undefined",
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "ReferenceError: y is not defined",
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Generic problem without error type",
      });

      // Force rebuild index
      // @ts-ignore - accessing private method for testing
      graphService.buildErrorTypeIndex();

      // Check the index
      // @ts-ignore - accessing private property for testing
      const errorTypeIndex = graphService.errorTypeIndex;
      
      expect(errorTypeIndex.has("type error")).toBe(true);
      expect(errorTypeIndex.has("reference error")).toBe(true);
      expect(errorTypeIndex.has("other")).toBe(true);
      
      expect(errorTypeIndex.get("type error")?.size).toBe(1);
      expect(errorTypeIndex.get("reference error")?.size).toBe(1);
      expect(errorTypeIndex.get("other")?.size).toBe(1);
    });

    it("should update index when creating new problems", async () => {
      // Create initial problem
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "SyntaxError: Unexpected token",
      });

      // @ts-ignore - accessing private property for testing
      const errorTypeIndex = graphService.errorTypeIndex;
      expect(errorTypeIndex.has("syntax error")).toBe(true);
      
      // Add another syntax error
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "SyntaxError: Missing semicolon",
      });

      expect(errorTypeIndex.get("syntax error")?.size).toBe(2);
    });

    it("should handle multiple error types in one message", async () => {
      // Create a problem with multiple error type mentions
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "TypeError occurred, but it might be a ReferenceError",
      });
      const nodeId = JSON.parse(result.content[0].text).nodeId;

      // @ts-ignore - accessing private property for testing
      const errorTypeIndex = graphService.errorTypeIndex;
      
      // Should be categorized under the first error type found
      expect(errorTypeIndex.get("type error")?.has(nodeId)).toBe(true);
      expect(errorTypeIndex.get("reference error")?.has(nodeId)).toBe(false);
    });
  });

  describe("Performance optimizations", () => {
    it("should efficiently handle large graphs", async () => {
      // Create a large number of nodes
      const nodeCount = 100;
      const nodeIds: string[] = [];
      
      for (let i = 0; i < nodeCount; i++) {
        const result = await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `Problem ${i}: ${i % 2 === 0 ? "TypeError" : "ReferenceError"}`,
        });
        nodeIds.push(JSON.parse(result.content[0].text).nodeId);
      }

      // Connect nodes in a complex pattern
      for (let i = 0; i < nodeCount - 1; i++) {
        if (i % 3 === 0) {
          await graphService.connect({
            action: ActionType.CONNECT,
            from: nodeIds[i],
            to: nodeIds[i + 1],
            type: "supports",
          });
        }
      }

      // Test query performance
      const startTime = Date.now();
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "TypeError in module",
          limit: 10,
        },
      });
      const queryTime = Date.now() - startTime;

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(queryTime).toBeLessThan(200); // Should be fast even with 100+ nodes
    });

    it("should use indexes for recent activity queries", async () => {
      // Create many nodes with relationships
      for (let i = 0; i < 50; i++) {
        const problemResult = await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `Problem ${i}`,
        });
        const problemId = JSON.parse(problemResult.content[0].text).nodeId;

        if (i % 5 === 0) {
          await graphService.create({
            action: ActionType.CREATE,
            nodeType: "hypothesis",
            content: `Hypothesis for ${i}`,
            parentId: problemId,
          });
        }
      }

      const startTime = Date.now();
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: {
          limit: 20,
        },
      });
      const queryTime = Date.now() - startTime;

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.nodes).toHaveLength(20);
      expect(queryTime).toBeLessThan(50); // Should be very fast with indexes
    });
  });
});