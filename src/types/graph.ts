// Graph-based debugging structure types

// Node types representing different elements in the debugging process
export type NodeType = 'problem' | 'hypothesis' | 'experiment' | 'observation' | 'learning' | 'solution';

// Edge types representing relationships between nodes
export type EdgeType = 
  | 'decomposes'    // Problem -> SubProblem
  | 'hypothesizes'  // Problem -> Hypothesis
  | 'tests'         // Hypothesis -> Experiment
  | 'produces'      // Experiment -> Observation
  | 'learns'        // Observation -> Learning
  | 'contradicts'   // Evidence -> Hypothesis (negative)
  | 'supports'      // Evidence -> Hypothesis (positive)
  | 'solves';       // Solution -> Problem

// Base node structure
export interface Node {
  id: string;
  type: NodeType;
  content: string;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    confidence?: number;  // 0-100, applicable for hypothesis and solution
    status?: 'open' | 'investigating' | 'solved' | 'abandoned';
    tags: string[];
    // Additional metadata based on node type
    [key: string]: any;
  };
}

// Edge structure representing relationships
export interface Edge {
  id: string;
  type: EdgeType;
  from: string;  // Node ID
  to: string;    // Node ID
  strength: number;  // 0-1, representing relationship strength
  metadata?: {
    reasoning?: string;
    evidence?: string;
    createdAt: Date;
    [key: string]: any;
  };
}

// The main graph structure
export interface DebugGraph {
  nodes: Map<string, Node>;
  edges: Map<string, Edge>;
  roots: string[];  // Root problem node IDs
  metadata: {
    createdAt: Date;
    lastModified: Date;
    sessionCount: number;
  };
}

// Specific node type interfaces for better type safety
export interface ProblemNode extends Node {
  type: 'problem';
  metadata: Node['metadata'] & {
    errorMessage?: string;
    context?: {
      language?: string;
      framework?: string;
      environment?: string;
    };
    isRoot: boolean;
  };
}

export interface HypothesisNode extends Node {
  type: 'hypothesis';
  metadata: Node['metadata'] & {
    confidence: number;  // Required for hypothesis
    assumptions?: string[];
    testable: boolean;
  };
}

export interface ExperimentNode extends Node {
  type: 'experiment';
  metadata: Node['metadata'] & {
    code?: string;
    commands?: string[];
    expectedOutcome: string;
    environment?: Record<string, any>;
  };
}

export interface ObservationNode extends Node {
  type: 'observation';
  metadata: Node['metadata'] & {
    output?: string;
    metrics?: Record<string, any>;
    unexpected?: boolean;
  };
}

export interface LearningNode extends Node {
  type: 'learning';
  metadata: Node['metadata'] & {
    applicability: string;  // When/where this learning applies
    confidence: number;
    category?: 'pattern' | 'anti-pattern' | 'best-practice' | 'insight';
  };
}

export interface SolutionNode extends Node {
  type: 'solution';
  metadata: Node['metadata'] & {
    implementation: string;
    verified: boolean;
    sideEffects?: string[];
    alternativeApproaches?: string[];
  };
}

// Type guards
export function isProblemNode(node: Node): node is ProblemNode {
  return node.type === 'problem';
}

export function isHypothesisNode(node: Node): node is HypothesisNode {
  return node.type === 'hypothesis';
}

export function isExperimentNode(node: Node): node is ExperimentNode {
  return node.type === 'experiment';
}

export function isObservationNode(node: Node): node is ObservationNode {
  return node.type === 'observation';
}

export function isLearningNode(node: Node): node is LearningNode {
  return node.type === 'learning';
}

export function isSolutionNode(node: Node): node is SolutionNode {
  return node.type === 'solution';
}