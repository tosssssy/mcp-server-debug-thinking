import { describe, it, expect } from "vitest";
import {
  type Node,
  type Edge,
  type ProblemNode,
  type HypothesisNode,
  type ExperimentNode,
  type ObservationNode,
  type LearningNode,
  type SolutionNode,
  isProblemNode,
  isHypothesisNode,
  isExperimentNode,
  isObservationNode,
  isLearningNode,
  isSolutionNode,
} from "../../types/graph.js";

describe("Graph Types", () => {
  describe("Node type guards", () => {
    it("should correctly identify problem nodes", () => {
      const problemNode: ProblemNode = {
        id: "p1",
        type: "problem",
        content: "Test problem",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          isRoot: true,
          status: "open",
        },
      };

      const otherNode: Node = {
        id: "h1",
        type: "hypothesis",
        content: "Test hypothesis",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        },
      };

      expect(isProblemNode(problemNode)).toBe(true);
      expect(isProblemNode(otherNode)).toBe(false);
    });

    it("should correctly identify hypothesis nodes", () => {
      const hypothesisNode: HypothesisNode = {
        id: "h1",
        type: "hypothesis",
        content: "Test hypothesis",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          confidence: 75,
          testable: true,
        },
      };

      expect(isHypothesisNode(hypothesisNode)).toBe(true);
      expect(isHypothesisNode({ ...hypothesisNode, type: "problem" } as any)).toBe(false);
    });

    it("should correctly identify experiment nodes", () => {
      const experimentNode: ExperimentNode = {
        id: "e1",
        type: "experiment",
        content: "Test experiment",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          expectedOutcome: "Success",
        },
      };

      expect(isExperimentNode(experimentNode)).toBe(true);
      expect(isExperimentNode({ ...experimentNode, type: "observation" } as any)).toBe(false);
    });

    it("should correctly identify observation nodes", () => {
      const observationNode: ObservationNode = {
        id: "o1",
        type: "observation",
        content: "Test observation",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          unexpected: false,
        },
      };

      expect(isObservationNode(observationNode)).toBe(true);
      expect(isObservationNode({ ...observationNode, type: "learning" } as any)).toBe(false);
    });

    it("should correctly identify learning nodes", () => {
      const learningNode: LearningNode = {
        id: "l1",
        type: "learning",
        content: "Test learning",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          applicability: "General",
          confidence: 90,
          category: "best-practice",
        },
      };

      expect(isLearningNode(learningNode)).toBe(true);
      expect(isLearningNode({ ...learningNode, type: "solution" } as any)).toBe(false);
    });

    it("should correctly identify solution nodes", () => {
      const solutionNode: SolutionNode = {
        id: "s1",
        type: "solution",
        content: "Test solution",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          implementation: "Fix the bug",
          verified: true,
        },
      };

      expect(isSolutionNode(solutionNode)).toBe(true);
      expect(isSolutionNode({ ...solutionNode, type: "problem" } as any)).toBe(false);
    });
  });

  describe("Edge types", () => {
    it("should have correct edge structure", () => {
      const edge: Edge = {
        id: "edge-1",
        type: "hypothesizes",
        from: "node-1",
        to: "node-2",
        strength: 0.85,
        metadata: {
          reasoning: "Based on similar patterns",
          createdAt: new Date(),
        },
      };

      expect(edge.id).toBe("edge-1");
      expect(edge.type).toBe("hypothesizes");
      expect(edge.from).toBe("node-1");
      expect(edge.to).toBe("node-2");
      expect(edge.strength).toBe(0.85);
      expect(edge.metadata?.reasoning).toBe("Based on similar patterns");
    });

    it("should support all edge types", () => {
      const edgeTypes = [
        "decomposes",
        "hypothesizes",
        "tests",
        "produces",
        "learns",
        "contradicts",
        "supports",
        "solves",
      ];

      edgeTypes.forEach((type) => {
        const edge: Edge = {
          id: `edge-${type}`,
          type: type as any,
          from: "a",
          to: "b",
          strength: 1,
        };
        expect(edge.type).toBe(type);
      });
    });
  });

  describe("Node metadata", () => {
    it("should support optional confidence in nodes", () => {
      const node: Node = {
        id: "n1",
        type: "hypothesis",
        content: "Test",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ["test"],
          confidence: 85,
        },
      };

      expect(node.metadata.confidence).toBe(85);
    });

    it("should support node status", () => {
      const problemNode: ProblemNode = {
        id: "p1",
        type: "problem",
        content: "Test problem",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          status: "investigating",
          isRoot: false,
        },
      };

      expect(problemNode.metadata.status).toBe("investigating");
    });

    it("should support additional metadata", () => {
      const node: Node = {
        id: "n1",
        type: "experiment",
        content: "Test",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ["test", "unit-test"],
          customField: "custom value",
          anotherField: 123,
        },
      };

      expect(node.metadata.customField).toBe("custom value");
      expect(node.metadata.anotherField).toBe(123);
      expect(node.metadata.tags).toHaveLength(2);
    });
  });

  describe("DebugGraph structure", () => {
    it("should have correct structure", () => {
      const graph = {
        nodes: new Map<string, Node>(),
        edges: new Map<string, Edge>(),
        roots: ["root-1", "root-2"],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          sessionCount: 10,
        },
      };

      expect(graph.nodes).toBeInstanceOf(Map);
      expect(graph.edges).toBeInstanceOf(Map);
      expect(graph.roots).toHaveLength(2);
      expect(graph.metadata.sessionCount).toBe(10);
    });
  });
});
