import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GraphService } from "../../services/GraphService.js";
import { ActionType } from "../../types/graphActions.js";

// Test suite for edge cases and boundary conditions
describe("GraphService - Edge Cases and Boundary Conditions", () => {
  let graphService: GraphService;

  beforeEach(async () => {
    process.env.DEBUG_DATA_DIR = `.test-edge-cases-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    graphService = new GraphService();
    await graphService.initialize();
  });

  afterEach(async () => {
    if (process.env.DEBUG_DATA_DIR) {
      const fs = await import("fs/promises");
      try {
        await fs.rm(process.env.DEBUG_DATA_DIR, { recursive: true, force: true });
      } catch (_error) {
        // Directory might not exist
      }
      delete process.env.DEBUG_DATA_DIR;
    }
  });

  describe("Empty and null value handling", () => {
    it("should handle empty content in problems", async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.nodeId).toBeDefined();
    });

    it("should handle whitespace-only content", async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "   \n\t   ",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it("should handle empty pattern in similarity search", async () => {
      // Create some problems first
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Test problem",
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "",
          limit: 5,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results).toBeDefined();
    });

    it("should handle undefined metadata gracefully", async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Test hypothesis",
        metadata: undefined,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);

      // Check that default metadata is applied
      const graph = graphService.getGraph();
      const node = graph.nodes.get(response.nodeId);
      expect(node?.metadata).toBeDefined();
      expect((node?.metadata as { confidence?: number }).confidence).toBe(50); // Default for hypothesis
    });

    it("should handle null values in metadata", async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "solution",
        content: "Test solution",
        metadata: {
          verified: null as unknown as boolean,
          customField: null,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });
  });

  describe("Extreme length handling", () => {
    it("should handle very long content", async () => {
      const longContent = `${"A".repeat(10000)} error message ${"B".repeat(10000)}`;

      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: longContent,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);

      // Verify the content was stored correctly
      const graph = graphService.getGraph();
      const node = graph.nodes.get(response.nodeId);
      expect(node?.content).toBe(longContent);
    });

    it("should handle similarity search with very long patterns", async () => {
      // Create a problem with long content
      const longProblem = `Error: ${"x".repeat(5000)} in module`;
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: longProblem,
      });

      // Search with a long pattern
      const longPattern = `Error: ${"x".repeat(4999)} in module`;
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: longPattern,
          limit: 5,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.results.problems.length > 0) {
        expect(response.results.problems[0].similarity).toBeGreaterThan(0.4);
      }
    });

    it("should handle very short content", async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "E",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });
  });

  describe("Special characters and encoding", () => {
    it("should handle unicode characters", async () => {
      const unicodeContent = "Error: 🚨 Failed to process émojis and ñoñ-ASCII çharacters λ→∞";

      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: unicodeContent,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);

      // Verify content is preserved
      const graph = graphService.getGraph();
      const node = graph.nodes.get(response.nodeId);
      expect(node?.content).toBe(unicodeContent);
    });

    it("should handle special regex characters in patterns", async () => {
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Error: Invalid regex pattern [a-z]+ found",
      });

      // Search with regex special characters
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "Error: Invalid regex pattern [a-z]+",
          limit: 5,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      // Should not crash due to regex special characters
    });

    it("should handle HTML/XML content", async () => {
      const htmlContent = 'Error: Cannot parse <div class="test">content</div>';

      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: htmlContent,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it("should handle JSON strings", async () => {
      const jsonContent = 'Error parsing JSON: {"key": "value", "nested": {"array": [1,2,3]}}';

      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: jsonContent,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it("should handle escaped characters", async () => {
      const escapedContent =
        "Error: Path not found \"C:\\Users\\Test\\file.txt\" or 'data\\n\\tvalue'";

      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: escapedContent,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });
  });

  describe("Numerical edge cases", () => {
    it("should handle edge strength at boundaries", async () => {
      // Create nodes
      const node1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Hypothesis 1",
      });
      const nodeId1 = JSON.parse(node1.content[0].text).nodeId;

      const node2 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Experiment 1",
      });
      const nodeId2 = JSON.parse(node2.content[0].text).nodeId;

      // Test minimum strength (0)
      const minResult = await graphService.connect({
        action: ActionType.CONNECT,
        from: nodeId1,
        to: nodeId2,
        type: "tests",
        strength: 0,
      });

      const minResponse = JSON.parse(minResult.content[0].text);
      expect(minResponse.success).toBe(true);

      // Test maximum strength (1)
      const node3 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Experiment 2",
      });
      const nodeId3 = JSON.parse(node3.content[0].text).nodeId;

      const maxResult = await graphService.connect({
        action: ActionType.CONNECT,
        from: nodeId1,
        to: nodeId3,
        type: "tests",
        strength: 1,
      });

      const maxResponse = JSON.parse(maxResult.content[0].text);
      expect(maxResponse.success).toBe(true);
    });

    it("should clamp edge strength values", async () => {
      // Create nodes
      const node1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "observation",
        content: "Observation 1",
      });
      const nodeId1 = JSON.parse(node1.content[0].text).nodeId;

      const node2 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "learning",
        content: "Learning 1",
      });
      const nodeId2 = JSON.parse(node2.content[0].text).nodeId;

      // Test over maximum strength
      const overResult = await graphService.connect({
        action: ActionType.CONNECT,
        from: nodeId1,
        to: nodeId2,
        type: "learns",
        strength: 999,
      });

      const overResponse = JSON.parse(overResult.content[0].text);
      expect(overResponse.success).toBe(true);

      // Check that strength was clamped to 1
      const graph = graphService.getGraph();
      const edge = Array.from(graph.edges.values()).find(
        (e) => e.from === nodeId1 && e.to === nodeId2
      );
      expect(edge?.strength).toBe(1);

      // Test negative strength
      const node3 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "learning",
        content: "Learning 2",
      });
      const nodeId3 = JSON.parse(node3.content[0].text).nodeId;

      const negResult = await graphService.connect({
        action: ActionType.CONNECT,
        from: nodeId1,
        to: nodeId3,
        type: "learns",
        strength: -5,
      });

      const negResponse = JSON.parse(negResult.content[0].text);
      expect(negResponse.success).toBe(true);

      // Check that strength was clamped to 0
      const negEdge = Array.from(graph.edges.values()).find(
        (e) => e.from === nodeId1 && e.to === nodeId3
      );
      expect(negEdge?.strength).toBe(0);
    });

    it("should handle confidence values correctly", async () => {
      // Test hypothesis with extreme confidence values
      const highConfResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "High confidence hypothesis",
        metadata: {
          confidence: 150, // Over 100
        },
      });

      const highConfResponse = JSON.parse(highConfResult.content[0].text);
      expect(highConfResponse.success).toBe(true);

      const lowConfResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Negative confidence hypothesis",
        metadata: {
          confidence: -50, // Negative
        },
      });

      const lowConfResponse = JSON.parse(lowConfResult.content[0].text);
      expect(lowConfResponse.success).toBe(true);
    });
  });

  describe("Concurrent operations", () => {
    it("should handle rapid node creation", async () => {
      const promises = [];
      const nodeCount = 20;

      // Create many nodes concurrently
      for (let i = 0; i < nodeCount; i++) {
        promises.push(
          graphService.create({
            action: ActionType.CREATE,
            nodeType: "problem",
            content: `Concurrent problem ${i}`,
          })
        );
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
        expect(response.nodeId).toBeDefined();
      });

      // Verify all nodes were created
      const graph = graphService.getGraph();
      expect(graph.nodes.size).toBeGreaterThanOrEqual(nodeCount);
    });

    it("should handle concurrent connections", async () => {
      // Create base nodes
      const node1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Central problem",
      });
      const centralId = JSON.parse(node1.content[0].text).nodeId;

      // Create multiple hypotheses
      const hypothesisIds = [];
      for (let i = 0; i < 10; i++) {
        const result = await graphService.create({
          action: ActionType.CREATE,
          nodeType: "hypothesis",
          content: `Hypothesis ${i}`,
        });
        hypothesisIds.push(JSON.parse(result.content[0].text).nodeId);
      }

      // Connect all hypotheses to central problem concurrently
      const connectPromises = hypothesisIds.map((hypId) =>
        graphService.connect({
          action: ActionType.CONNECT,
          from: centralId,
          to: hypId,
          type: "hypothesizes",
        })
      );

      const connectResults = await Promise.all(connectPromises);

      // All connections should succeed
      connectResults.forEach((result) => {
        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      });

      // Verify all edges were created
      const graph = graphService.getGraph();
      const edges = Array.from(graph.edges.values()).filter((e) => e.from === centralId);
      expect(edges.length).toBe(10);
    });
  });

  describe("Invalid input handling", () => {
    it("should handle invalid node types", async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "invalid-type" as never,
        content: "Test content",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true); // Should still create, type system prevents this in practice
    });

    it("should handle invalid edge types", async () => {
      // Create nodes
      const node1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Problem 1",
      });
      const nodeId1 = JSON.parse(node1.content[0].text).nodeId;

      const node2 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Hypothesis 1",
      });
      const nodeId2 = JSON.parse(node2.content[0].text).nodeId;

      const result = await graphService.connect({
        action: ActionType.CONNECT,
        from: nodeId1,
        to: nodeId2,
        type: "invalid-edge-type" as never,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true); // Should still connect, type system prevents this in practice
    });

    it("should handle circular parent relationships", async () => {
      // Create first node
      const node1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Node 1",
      });
      const nodeId1 = JSON.parse(node1.content[0].text).nodeId;

      // Create second node with first as parent
      const node2 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Node 2",
        parentId: nodeId1,
      });
      const nodeId2 = JSON.parse(node2.content[0].text).nodeId;

      // Try to create third node that would create a circle
      const node3 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Node 3",
        parentId: nodeId2,
      });
      const nodeId3 = JSON.parse(node3.content[0].text).nodeId;

      // The system should handle this gracefully
      expect(nodeId3).toBeDefined();
    });
  });

  describe("Query edge cases", () => {
    it("should handle queries with no results", async () => {
      // Create at least one problem for other tests
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Test problem for threshold test",
      });
      // Query for something that doesn't exist
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "This exact string will never match anything 12345!@#$%",
          limit: 10,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.problems).toEqual([]);
    });

    it("should handle queries with limit 0", async () => {
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Test problem",
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: {
          limit: 0,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.nodes.length).toBe(0);
    });

    it("should handle queries with very high limits", async () => {
      // Create just a few nodes
      for (let i = 0; i < 5; i++) {
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `Problem ${i}`,
        });
      }

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: {
          limit: 999999,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.nodes.length).toBe(5); // Should return only what exists
    });

    it("should handle similarity threshold edge cases", async () => {
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Test problem",
      });

      // Test with similarity threshold of 1.0 (exact match only)
      const exactResult = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "Different problem",
          minSimilarity: 1.0,
        },
      });

      const exactResponse = JSON.parse(exactResult.content[0].text);
      expect(exactResponse.success).toBe(true);
      expect(exactResponse.results.problems).toEqual([]);

      // Test with similarity threshold of 0 (return everything)
      const allResult = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "Any pattern",
          minSimilarity: 0,
        },
      });

      const allResponse = JSON.parse(allResult.content[0].text);
      expect(allResponse.success).toBe(true);
      expect(allResponse.results.problems.length).toBeGreaterThan(0);
    });
  });

  describe("Memory and performance boundaries", () => {
    it("should handle graphs with many edges from single node", async () => {
      // Create a hub node
      const hub = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Hub problem",
      });
      const hubId = JSON.parse(hub.content[0].text).nodeId;

      // Create many connected nodes
      const connectedCount = 50;
      for (let i = 0; i < connectedCount; i++) {
        const _node = await graphService.create({
          action: ActionType.CREATE,
          nodeType: "hypothesis",
          content: `Connected hypothesis ${i}`,
          parentId: hubId,
        });
      }

      // Query to verify performance
      const startTime = Date.now();
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: { limit: 10 },
      });
      const queryTime = Date.now() - startTime;

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(queryTime).toBeLessThan(100); // Should still be fast
    });

    it("should handle deep hierarchies", async () => {
      let currentParentId: string | undefined;
      const depth = 20;

      // Create a deep chain
      for (let i = 0; i < depth; i++) {
        const nodeType = i === 0 ? "problem" : i === depth - 1 ? "solution" : "hypothesis";

        const result = await graphService.create({
          action: ActionType.CREATE,
          nodeType,
          content: `Level ${i} node`,
          parentId: currentParentId,
        });
        currentParentId = JSON.parse(result.content[0].text).nodeId;
      }

      // Should handle deep hierarchies without stack overflow
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: { limit: 25 },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.nodes.length).toBe(depth);
    });
  });

  describe("Data consistency edge cases", () => {
    it("should maintain consistency when nodes are referenced before creation", async () => {
      // This shouldn't happen in normal usage, but test defensive programming
      const nonExistentId = "non-existent-node-id";

      const result = await graphService.connect({
        action: ActionType.CONNECT,
        from: nonExistentId,
        to: nonExistentId,
        type: "supports",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.message).toContain("not found");
    });

    it("should handle duplicate edge creation", async () => {
      // Create nodes
      const node1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Hypothesis 1",
      });
      const nodeId1 = JSON.parse(node1.content[0].text).nodeId;

      const node2 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Experiment 1",
      });
      const nodeId2 = JSON.parse(node2.content[0].text).nodeId;

      // Create first edge
      await graphService.connect({
        action: ActionType.CONNECT,
        from: nodeId1,
        to: nodeId2,
        type: "tests",
      });

      // Create duplicate edge
      const dupResult = await graphService.connect({
        action: ActionType.CONNECT,
        from: nodeId1,
        to: nodeId2,
        type: "tests",
      });

      const dupResponse = JSON.parse(dupResult.content[0].text);
      expect(dupResponse.success).toBe(true); // Should allow duplicates but with different IDs

      // Verify both edges exist
      const graph = graphService.getGraph();
      const edges = Array.from(graph.edges.values()).filter(
        (e) => e.from === nodeId1 && e.to === nodeId2 && e.type === "tests"
      );
      expect(edges.length).toBe(2);
    });

    it("should handle self-referencing edges", async () => {
      const node = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Self-referencing hypothesis",
      });
      const nodeId = JSON.parse(node.content[0].text).nodeId;

      // Create self-referencing edge
      const result = await graphService.connect({
        action: ActionType.CONNECT,
        from: nodeId,
        to: nodeId,
        type: "supports",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true); // Should allow self-references

      // Verify edge was created
      const graph = graphService.getGraph();
      const selfEdge = Array.from(graph.edges.values()).find(
        (e) => e.from === nodeId && e.to === nodeId
      );
      expect(selfEdge).toBeDefined();
    });
  });
});
