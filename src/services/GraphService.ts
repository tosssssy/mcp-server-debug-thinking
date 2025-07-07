import { v4 as uuidv4 } from 'uuid';
import { 
  Node, 
  Edge, 
  DebugGraph, 
  NodeType,
  EdgeType,
  ProblemNode,
  HypothesisNode,
  ExperimentNode,
  ObservationNode,
  LearningNode,
  SolutionNode
} from '../types/graph.js';
import {
  ActionType,
  CreateAction,
  ConnectAction,
  QueryAction,
  CreateResponse,
  ConnectResponse,
  QueryResponse,
  SimilarProblemsResult,
  SuccessfulPatternsResult,
  LearningPathResult,
  GraphVisualizationResult,
  getAutoEdgeType
} from '../types/graphActions.js';
import { logger } from '../utils/logger.js';
import { GraphStorage } from './GraphStorage.js';
import { createJsonResponse } from '../utils/format.js';

export class GraphService {
  private graph: DebugGraph;
  private storage: GraphStorage;

  constructor() {
    this.graph = {
      nodes: new Map(),
      edges: new Map(),
      roots: [],
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        sessionCount: 0
      }
    };
    this.storage = new GraphStorage();
  }

  async initialize(): Promise<void> {
    try {
      await this.storage.initialize();
      const loadedGraph = await this.storage.loadGraph();
      if (loadedGraph) {
        this.graph = loadedGraph;
        logger.success(`Loaded graph with ${this.graph.nodes.size} nodes and ${this.graph.edges.size} edges`);
      }
    } catch (error) {
      logger.error('Failed to initialize GraphService:', error);
      throw error;
    }
  }

  // CREATE action implementation
  async create(action: CreateAction) {
    try {
      const nodeId = uuidv4();
      const now = new Date();
      
      // Create base node
      const node: Node = {
        id: nodeId,
        type: action.nodeType,
        content: action.content,
        metadata: {
          createdAt: now,
          updatedAt: now,
          tags: action.metadata?.tags || [],
          ...action.metadata
        }
      };

      // Add type-specific metadata
      this.enrichNodeMetadata(node);

      // Add node to graph
      this.graph.nodes.set(nodeId, node);

      // Handle parent relationship
      let edgeId: string | undefined;
      if (action.parentId) {
        const parentNode = this.graph.nodes.get(action.parentId);
        if (!parentNode) {
          return createJsonResponse({
            success: false,
            message: `Parent node ${action.parentId} not found`
          }, true);
        }

        // Determine edge type
        const edgeType = getAutoEdgeType(parentNode.type, action.nodeType);
        if (edgeType) {
          const edge = this.createEdge(action.parentId, nodeId, edgeType);
          this.graph.edges.set(edge.id, edge);
          edgeId = edge.id;
        }
      } else if (action.nodeType === 'problem') {
        // Add to roots if it's a root problem
        this.graph.roots.push(nodeId);
        (node as ProblemNode).metadata.isRoot = true;
      }

      // Update graph metadata
      this.graph.metadata.lastModified = now;

      // Save to storage
      await this.storage.saveNode(node);
      if (edgeId) {
        await this.storage.saveEdge(this.graph.edges.get(edgeId)!);
      }

      // Generate suggestions
      const suggestions = await this.generateSuggestions(node);

      const response: CreateResponse = {
        success: true,
        nodeId,
        edgeId,
        message: `Created ${action.nodeType} node`,
        suggestions
      };
      return createJsonResponse(response);
    } catch (error) {
      logger.error('Error in create action:', error);
      return createJsonResponse({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      }, true);
    }
  }

  // CONNECT action implementation
  async connect(action: ConnectAction) {
    try {
      const fromNode = this.graph.nodes.get(action.from);
      const toNode = this.graph.nodes.get(action.to);

      if (!fromNode || !toNode) {
        return createJsonResponse({
          success: false,
          message: `Node(s) not found: ${!fromNode ? action.from : ''} ${!toNode ? action.to : ''}`
        }, true);
      }

      // Check for conflicts
      const conflicts = this.checkForConflicts(action);
      
      // Create edge
      const edge = this.createEdge(
        action.from,
        action.to,
        action.type,
        action.strength,
        action.metadata
      );

      this.graph.edges.set(edge.id, edge);
      
      // Update graph metadata
      this.graph.metadata.lastModified = new Date();

      // Save to storage
      await this.storage.saveEdge(edge);

      const response: ConnectResponse = {
        success: true,
        edgeId: edge.id,
        message: `Connected ${fromNode.type} to ${toNode.type} with ${action.type}`,
        conflicts: conflicts.length > 0 ? {
          conflictingEdges: conflicts.map(e => e.id),
          explanation: 'This connection may contradict existing relationships'
        } : undefined
      };
      return createJsonResponse(response);
    } catch (error) {
      logger.error('Error in connect action:', error);
      return createJsonResponse({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      }, true);
    }
  }

  // QUERY action implementation
  async query(action: QueryAction) {
    const startTime = Date.now();
    
    try {
      let results: any;
      
      switch (action.type) {
        case 'similar-problems':
          results = await this.findSimilarProblems(action.parameters);
          break;
        case 'successful-patterns':
          results = await this.findSuccessfulPatterns(action.parameters);
          break;
        case 'learning-path':
          results = await this.traceLearningPath(action.parameters);
          break;
        case 'graph-visualization':
          results = await this.generateVisualization(action.parameters);
          break;
        case 'node-details':
          results = await this.getNodeDetails(action.parameters?.nodeId);
          break;
        case 'related-nodes':
          results = await this.findRelatedNodes(action.parameters?.nodeId);
          break;
        default:
          return createJsonResponse({
            success: false,
            message: `Unknown query type: ${action.type}`
          }, true);
      }

      const response: QueryResponse = {
        success: true,
        results,
        queryTime: Date.now() - startTime
      };
      return createJsonResponse(response);
    } catch (error) {
      logger.error('Error in query action:', error);
      return createJsonResponse({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        queryTime: Date.now() - startTime
      }, true);
    }
  }

  // Helper methods
  private enrichNodeMetadata(node: Node): void {
    switch (node.type) {
      case 'problem':
        (node as ProblemNode).metadata.status = 'open';
        (node as ProblemNode).metadata.isRoot = false;
        break;
      case 'hypothesis':
        if (!node.metadata.confidence) {
          (node as HypothesisNode).metadata.confidence = 50;
        }
        (node as HypothesisNode).metadata.testable = true;
        break;
      case 'learning':
        if (!node.metadata.confidence) {
          (node as LearningNode).metadata.confidence = 70;
        }
        break;
    }
  }

  private createEdge(
    from: string,
    to: string,
    type: EdgeType,
    strength: number = 1,
    metadata?: any
  ): Edge {
    return {
      id: uuidv4(),
      type,
      from,
      to,
      strength: Math.max(0, Math.min(1, strength)),
      metadata: {
        createdAt: new Date(),
        ...metadata
      }
    };
  }

  private checkForConflicts(action: ConnectAction): Edge[] {
    const conflicts: Edge[] = [];
    
    // Check for contradicting edges
    if (action.type === 'contradicts') {
      // Find any 'supports' edges between the same nodes
      for (const edge of this.graph.edges.values()) {
        if (edge.type === 'supports' && 
            edge.from === action.from && 
            edge.to === action.to) {
          conflicts.push(edge);
        }
      }
    } else if (action.type === 'supports') {
      // Find any 'contradicts' edges between the same nodes
      for (const edge of this.graph.edges.values()) {
        if (edge.type === 'contradicts' && 
            edge.from === action.from && 
            edge.to === action.to) {
          conflicts.push(edge);
        }
      }
    }
    
    return conflicts;
  }

  private async generateSuggestions(node: Node): Promise<any> {
    const suggestions: any = {};
    
    if (node.type === 'problem') {
      // Find similar problems
      const similar = await this.findSimilarProblems({
        pattern: node.content,
        limit: 3
      });
      if (similar.problems.length > 0) {
        suggestions.relatedProblems = similar.problems.map(p => p.nodeId);
      }
    } else if (node.type === 'hypothesis') {
      // Suggest experiments
      suggestions.recommendedExperiments = [
        'Test the hypothesis in isolation',
        'Create a minimal reproducible example',
        'Check assumptions with logging'
      ];
    }
    
    return suggestions;
  }

  // Query implementations
  private async findSimilarProblems(params: any): Promise<SimilarProblemsResult> {
    const problems: any[] = [];
    const pattern = params?.pattern?.toLowerCase() || '';
    
    for (const node of this.graph.nodes.values()) {
      if (node.type === 'problem' && node.content.toLowerCase().includes(pattern)) {
        const solutions = this.findSolutionsForProblem(node.id);
        problems.push({
          nodeId: node.id,
          content: node.content,
          similarity: this.calculateSimilarity(pattern, node.content),
          solutions
        });
      }
    }
    
    // Sort by similarity
    problems.sort((a, b) => b.similarity - a.similarity);
    
    return {
      problems: problems.slice(0, params?.limit || 10)
    };
  }

  private findSolutionsForProblem(problemId: string): any[] {
    const solutions: any[] = [];
    
    for (const edge of this.graph.edges.values()) {
      if (edge.type === 'solves' && edge.to === problemId) {
        const solutionNode = this.graph.nodes.get(edge.from);
        if (solutionNode && solutionNode.type === 'solution') {
          solutions.push({
            nodeId: solutionNode.id,
            content: solutionNode.content,
            verified: (solutionNode as SolutionNode).metadata.verified
          });
        }
      }
    }
    
    return solutions;
  }

  private calculateSimilarity(pattern: string, content: string): number {
    // Simple similarity calculation
    const words1 = pattern.toLowerCase().split(/\s+/);
    const words2 = content.toLowerCase().split(/\s+/);
    const common = words1.filter(w => words2.includes(w));
    return common.length / Math.max(words1.length, words2.length);
  }

  private async findSuccessfulPatterns(params: any): Promise<SuccessfulPatternsResult> {
    // Implementation would analyze paths from problem to solution
    // For now, return empty result
    return { patterns: [] };
  }

  private async traceLearningPath(params: any): Promise<LearningPathResult> {
    const nodeId = params?.nodeId;
    if (!nodeId) {
      return { path: [] };
    }
    
    const path: any[] = [];
    const visited = new Set<string>();
    
    // Simple BFS to trace path
    const queue = [nodeId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      
      visited.add(currentId);
      const node = this.graph.nodes.get(currentId);
      if (!node) continue;
      
      const connections = [];
      for (const edge of this.graph.edges.values()) {
        if (edge.from === currentId) {
          connections.push({ type: edge.type, to: edge.to });
          queue.push(edge.to);
        }
      }
      
      path.push({
        nodeId: currentId,
        type: node.type,
        content: node.content,
        connections
      });
    }
    
    return { path };
  }

  private async generateVisualization(params: any): Promise<GraphVisualizationResult> {
    const format = params?.format || 'mermaid';
    let content = '';
    
    if (format === 'mermaid') {
      content = 'graph TD\n';
      
      // Add nodes
      for (const node of this.graph.nodes.values()) {
        const label = `${node.type}:${node.content.substring(0, 30)}...`;
        content += `  ${node.id}["${label}"]\n`;
      }
      
      // Add edges
      for (const edge of this.graph.edges.values()) {
        content += `  ${edge.from} -->|${edge.type}| ${edge.to}\n`;
      }
    }
    
    return {
      format,
      content,
      nodeCount: this.graph.nodes.size,
      edgeCount: this.graph.edges.size
    };
  }

  private async getNodeDetails(nodeId?: string): Promise<any> {
    if (!nodeId) return null;
    
    const node = this.graph.nodes.get(nodeId);
    if (!node) return null;
    
    const incomingEdges = [];
    const outgoingEdges = [];
    
    for (const edge of this.graph.edges.values()) {
      if (edge.to === nodeId) {
        incomingEdges.push(edge);
      } else if (edge.from === nodeId) {
        outgoingEdges.push(edge);
      }
    }
    
    return {
      node,
      incomingEdges,
      outgoingEdges
    };
  }

  private async findRelatedNodes(nodeId?: string): Promise<any> {
    if (!nodeId) return [];
    
    const related = new Set<string>();
    
    for (const edge of this.graph.edges.values()) {
      if (edge.from === nodeId) {
        related.add(edge.to);
      } else if (edge.to === nodeId) {
        related.add(edge.from);
      }
    }
    
    return Array.from(related).map(id => this.graph.nodes.get(id)).filter(Boolean);
  }

  // Public methods for session management
  async saveGraph(): Promise<void> {
    await this.storage.saveGraphMetadata(this.graph);
  }

  getGraph(): DebugGraph {
    return this.graph;
  }
}