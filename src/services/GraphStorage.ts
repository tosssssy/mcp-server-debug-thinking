import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { Node, Edge, DebugGraph } from '../types/graph.js';
import { 
  ensureDirectory, 
  writeJsonFile,
  appendJsonLine,
  readJsonLines,
  fileExists
} from '../utils/storage.js';
import { logger } from '../utils/logger.js';
import { DATA_DIR_NAME } from '../constants.js';

export class GraphStorage {
  private dataDir: string;
  private nodesFile: string;
  private edgesFile: string;
  private metadataFile: string;

  constructor() {
    const baseDir = process.env.DEBUG_DATA_DIR || os.homedir();
    this.dataDir = path.join(baseDir, DATA_DIR_NAME);
    this.nodesFile = path.join(this.dataDir, 'nodes.jsonl');
    this.edgesFile = path.join(this.dataDir, 'edges.jsonl');
    this.metadataFile = path.join(this.dataDir, 'graph-metadata.json');
  }

  async initialize(): Promise<void> {
    await ensureDirectory(this.dataDir);
    logger.dim(`📁 Graph storage initialized at: ${this.dataDir}`);
  }

  async saveNode(node: Node): Promise<void> {
    try {
      // Convert Map to serializable format
      const serializable = {
        ...node,
        metadata: {
          ...node.metadata,
          createdAt: node.metadata.createdAt.toISOString(),
          updatedAt: node.metadata.updatedAt.toISOString()
        }
      };
      await appendJsonLine(this.nodesFile, serializable);
    } catch (error) {
      logger.error('Failed to save node:', error);
      throw error;
    }
  }

  async saveEdge(edge: Edge): Promise<void> {
    try {
      // Convert to serializable format
      const serializable = {
        ...edge,
        metadata: edge.metadata ? {
          ...edge.metadata,
          createdAt: edge.metadata.createdAt.toISOString()
        } : undefined
      };
      await appendJsonLine(this.edgesFile, serializable);
    } catch (error) {
      logger.error('Failed to save edge:', error);
      throw error;
    }
  }

  async saveGraphMetadata(graph: DebugGraph): Promise<void> {
    try {
      const metadata = {
        ...graph.metadata,
        createdAt: graph.metadata.createdAt.toISOString(),
        lastModified: graph.metadata.lastModified.toISOString(),
        roots: graph.roots,
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.size
      };
      await writeJsonFile(this.metadataFile, metadata);
    } catch (error) {
      logger.error('Failed to save graph metadata:', error);
      throw error;
    }
  }

  async loadGraph(): Promise<DebugGraph | null> {
    try {
      // Check if files exist
      const hasNodes = await fileExists(this.nodesFile);
      const hasEdges = await fileExists(this.edgesFile);
      const hasMetadata = await fileExists(this.metadataFile);

      if (!hasNodes && !hasEdges && !hasMetadata) {
        return null;
      }

      // Load metadata
      let metadata: any = {
        createdAt: new Date(),
        lastModified: new Date(),
        sessionCount: 0
      };
      let roots: string[] = [];

      if (hasMetadata) {
        try {
          const content = await fs.readFile(this.metadataFile, 'utf-8');
          const meta = JSON.parse(content);
          metadata = {
            ...meta,
            createdAt: new Date(meta.createdAt),
            lastModified: new Date(meta.lastModified)
          };
          // Load roots from metadata
          roots = meta.roots || [];
        } catch (error) {
          logger.error('Failed to load metadata:', error);
        }
      }

      // Create graph structure
      const graph: DebugGraph = {
        nodes: new Map(),
        edges: new Map(),
        roots,
        metadata
      };

      // Load nodes
      if (hasNodes) {
        const nodes = await readJsonLines<any>(this.nodesFile);
        // Deduplicate nodes by keeping the latest version
        const nodeMap = new Map<string, any>();
        for (const node of nodes) {
          nodeMap.set(node.id, node);
        }
        
        for (const node of nodeMap.values()) {
          graph.nodes.set(node.id, {
            ...node,
            metadata: {
              ...node.metadata,
              createdAt: new Date(node.metadata.createdAt),
              updatedAt: new Date(node.metadata.updatedAt)
            }
          });
        }
      }

      // Load edges
      if (hasEdges) {
        const edges = await readJsonLines<any>(this.edgesFile);
        // Deduplicate edges by keeping the latest version
        const edgeMap = new Map<string, any>();
        for (const edge of edges) {
          edgeMap.set(edge.id, edge);
        }
        
        for (const edge of edgeMap.values()) {
          graph.edges.set(edge.id, {
            ...edge,
            metadata: edge.metadata ? {
              ...edge.metadata,
              createdAt: new Date(edge.metadata.createdAt)
            } : undefined
          });
        }
      }

      return graph;
    } catch (error) {
      logger.error('Failed to load graph:', error);
      return null;
    }
  }

  async clearStorage(): Promise<void> {
    // This method would be used for testing or resetting
    // Implementation depends on requirements
  }
}