import { NodeType, EdgeType } from './graph.js';

// Action type enum
export enum ActionType {
  CREATE = 'create',
  CONNECT = 'connect',
  QUERY = 'query'
}

// Base action interface
interface BaseAction {
  action: ActionType;
}

// CREATE action - creates a new node
export interface CreateAction extends BaseAction {
  action: ActionType.CREATE;
  nodeType: NodeType;
  content: string;
  parentId?: string;  // If provided, automatically creates an edge
  metadata?: {
    confidence?: number;
    tags?: string[];
    [key: string]: any;
  };
}

// CONNECT action - creates or updates edges between nodes
export interface ConnectAction extends BaseAction {
  action: ActionType.CONNECT;
  from: string;  // Source node ID
  to: string;    // Target node ID
  type: EdgeType;
  strength?: number;  // 0-1, defaults to 1
  metadata?: {
    reasoning?: string;
    evidence?: string;
    [key: string]: any;
  };
}

// Query types
export type QueryType = 
  | 'similar-problems'      // Find similar problems based on content/context
  | 'successful-patterns'   // Find successful solution patterns
  | 'failed-hypotheses'     // Find hypotheses that were contradicted
  | 'learning-path'         // Trace the learning path from a problem
  | 'solution-candidates'   // Find potential solutions for a problem
  | 'graph-visualization'   // Get graph structure for visualization
  | 'node-details'         // Get detailed information about a node
  | 'related-nodes'        // Find all nodes related to a given node
  | 'pattern-match';       // Find patterns matching certain criteria

// QUERY action - searches and analyzes the graph
export interface QueryAction extends BaseAction {
  action: ActionType.QUERY;
  type: QueryType;
  parameters?: {
    nodeId?: string;        // Reference node for the query
    pattern?: string;       // Search pattern (text)
    nodeTypes?: NodeType[]; // Filter by node types
    edgeTypes?: EdgeType[]; // Filter by edge types
    confidence?: number;    // Minimum confidence threshold
    limit?: number;         // Maximum results to return
    depth?: number;         // Graph traversal depth
    timeRange?: {
      start?: Date;
      end?: Date;
    };
    tags?: string[];        // Filter by tags
  };
}

// Union type for all actions
export type GraphAction = CreateAction | ConnectAction | QueryAction;

// Response types
export interface CreateResponse {
  success: boolean;
  nodeId?: string;
  edgeId?: string;  // If an edge was auto-created
  message?: string;
  suggestions?: {
    relatedProblems?: string[];
    possibleHypotheses?: string[];
    recommendedExperiments?: string[];
  };
}

export interface ConnectResponse {
  success: boolean;
  edgeId?: string;
  message?: string;
  conflicts?: {  // If the connection contradicts existing knowledge
    conflictingEdges: string[];
    explanation: string;
  };
}

export interface QueryResponse {
  success: boolean;
  results?: any;  // Type depends on query type
  message?: string;
  queryTime?: number;  // Time taken in ms
}

// Specific query response types
export interface SimilarProblemsResult {
  problems: Array<{
    nodeId: string;
    content: string;
    similarity: number;  // 0-1
    solutions?: Array<{
      nodeId: string;
      content: string;
      verified: boolean;
    }>;
  }>;
}

export interface SuccessfulPatternsResult {
  patterns: Array<{
    description: string;
    frequency: number;
    successRate: number;
    examplePaths: Array<{
      problem: string;
      hypothesis: string;
      experiment: string;
      solution: string;
    }>;
  }>;
}

export interface LearningPathResult {
  path: Array<{
    nodeId: string;
    type: NodeType;
    content: string;
    connections: Array<{
      type: EdgeType;
      to: string;
    }>;
  }>;
}

export interface GraphVisualizationResult {
  format: 'mermaid' | 'dot' | 'json';
  content: string;
  nodeCount: number;
  edgeCount: number;
}

// Helper function to determine parent-child edge type
export function getAutoEdgeType(parentType: NodeType, childType: NodeType): EdgeType | null {
  const mapping: Record<string, EdgeType> = {
    'problem-problem': 'decomposes',
    'problem-hypothesis': 'hypothesizes',
    'hypothesis-experiment': 'tests',
    'experiment-observation': 'produces',
    'observation-learning': 'learns',
    'solution-problem': 'solves',
  };
  
  return mapping[`${parentType}-${childType}`] || null;
}