export interface CodeChange {
  file: string;
  lineRange: [number, number];
  oldCode: string;
  newCode: string;
  reasoning: string;
}

export interface Problem {
  description: string;
  errorMessage?: string;
  expectedBehavior: string;
  actualBehavior: string;
}

export interface ThinkingStep {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  timestamp: Date;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
}

export interface Hypothesis {
  cause: string;
  affectedCode: string[];
  confidence: number;
  thinkingChain?: ThinkingStep[];  // 思考プロセスの記録
  thoughtConclusion?: string;       // sequential-thinkingの最終結論
}

export interface Experiment {
  changes: CodeChange[];
  testCommand?: string;
  expectedOutcome: string;
}

export interface Result {
  success: boolean;
  output?: string;
  newErrors?: string[];
  learning: string;
}

export interface CodeThinkingStep {
  id: string;
  timestamp: Date;
  problem?: Problem;
  hypothesis?: Hypothesis;
  experiment?: Experiment;
  result?: Result;
  nextAction?: "fixed" | "iterate" | "pivot" | "research";
  thinkingSteps?: ThinkingStep[];  // このステップに関連する思考プロセス
}

export interface ErrorPattern {
  pattern: string;
  commonCause: string;
  suggestedFix: string;
  occurrences: number;
}

export interface Fix {
  problemId: string;
  solution: string;
  changes: CodeChange[];
  verified: boolean;
}

export interface DebugSession {
  id: string;
  startTime: Date;
  problem?: Problem;
  steps: CodeThinkingStep[];
  metadata?: {
    language?: string;
    framework?: string;
    tags?: string[];
  };
  thoughtHistory: ThinkingStep[];
  branches: Record<string, ThinkingStep[]>;
  currentBranch?: string;
}