// Simplified action parameter types

export interface StartParams {
  problem?: string;
  context?: {
    error?: string;
    language?: string;
    framework?: string;
    tags?: string[];
  };
}

export interface ThinkParams {
  thought: string;
  nextThoughtNeeded: boolean;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
}

export interface ExperimentParams {
  description: string;
  changes: Array<{
    file: string;
    change: string;
    reason: string;
  }>;
  expected: string;
}

export interface ObserveParams {
  success: boolean;
  output?: string;
  learning: string;
  next?: "fixed" | "iterate" | "pivot";
}

export interface SearchParams {
  query: string;
  filters?: {
    type?: "error" | "solution" | "pattern";
    confidence?: number;
    language?: string;
    limit?: number;
  };
}

export interface EndParams {
  summary?: boolean;
}