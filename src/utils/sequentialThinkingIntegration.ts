import { ThinkingStep } from '../types/debug.js';

/**
 * Sequential Thinking Integration Helper
 * 
 * This module provides utilities to integrate sequential-thinking MCP output
 * with debug-iteration-mcp for seamless debugging workflows.
 */

export interface SequentialThinkingOutput {
  thought: string;
  nextThoughtNeeded: boolean;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
}

/**
 * Convert sequential-thinking output to ThinkingStep format
 */
export function convertToThinkingStep(output: SequentialThinkingOutput): ThinkingStep {
  return {
    thought: output.thought,
    thoughtNumber: output.thoughtNumber,
    totalThoughts: output.totalThoughts,
    timestamp: new Date(),
    isRevision: output.isRevision,
    revisesThought: output.revisesThought,
    branchFromThought: output.branchFromThought,
    branchId: output.branchId
  };
}

/**
 * Extract conclusion from a series of thinking steps
 */
export function extractConclusion(steps: ThinkingStep[]): string {
  // Find the last non-revision thought or the final thought
  const conclusionStep = steps
    .filter(step => !step.isRevision)
    .pop() || steps[steps.length - 1];
    
  return conclusionStep?.thought || '';
}

/**
 * Estimate confidence based on thinking process
 */
export function estimateConfidence(steps: ThinkingStep[]): number {
  const baseConfidence = 70;
  const factors = {
    // More thinking steps generally mean more thorough analysis
    depthBonus: Math.min(steps.length * 2, 10),
    // Revisions indicate careful consideration
    revisionBonus: steps.filter(s => s.isRevision).length * 5,
    // Completed thinking chain adds confidence
    completionBonus: steps.some(s => s.thoughtNumber === s.totalThoughts) ? 10 : 0
  };
  
  const totalConfidence = baseConfidence + 
    factors.depthBonus + 
    factors.revisionBonus + 
    factors.completionBonus;
    
  return Math.min(totalConfidence, 100);
}

/**
 * Generate a hypothesis cause from thinking steps
 */
export function generateHypothesisCause(steps: ThinkingStep[]): string {
  const conclusion = extractConclusion(steps);
  
  // Extract key insights from the thinking process
  const keyInsights = steps
    .filter(step => 
      step.thought.includes('cause') ||
      step.thought.includes('reason') ||
      step.thought.includes('because') ||
      step.thought.includes('due to')
    )
    .map(step => step.thought);
    
  if (keyInsights.length > 0) {
    // Combine conclusion with key insights
    return `${conclusion}\n\nKey insights:\n${keyInsights.map(i => `- ${i}`).join('\n')}`;
  }
  
  return conclusion;
}

/**
 * Suggest affected code areas based on thinking analysis
 */
export function suggestAffectedCode(steps: ThinkingStep[]): string[] {
  const codeReferences: string[] = [];
  
  for (const step of steps) {
    // Look for file paths (common patterns)
    const fileMatches = step.thought.match(/(?:^|\s)(\S+\.(js|ts|jsx|tsx|py|java|cpp|c|go|rs|rb))/gi);
    if (fileMatches) {
      codeReferences.push(...fileMatches.map(m => m.trim()));
    }
    
    // Look for function/method names
    const functionMatches = step.thought.match(/(?:function|method|class|def|fn)\s+(\w+)/gi);
    if (functionMatches) {
      codeReferences.push(...functionMatches.map(m => m.split(/\s+/).pop() || ''));
    }
    
    // Look for line number references
    const lineMatches = step.thought.match(/(?:line|L)\.?\s*(\d+)/gi);
    if (lineMatches) {
      codeReferences.push(...lineMatches);
    }
  }
  
  // Remove duplicates and return
  return [...new Set(codeReferences)];
}

/**
 * Create a complete workflow from sequential thinking to hypothesis
 */
export interface ThinkingWorkflowResult {
  thinkingSteps: ThinkingStep[];
  hypothesis: {
    cause: string;
    affectedCode: string[];
    confidence: number;
    thoughtConclusion: string;
  };
  suggestedNextAction: 'iterate' | 'pivot' | 'research' | 'fixed';
}

export function createThinkingWorkflow(
  sequentialOutputs: SequentialThinkingOutput[]
): ThinkingWorkflowResult {
  const thinkingSteps = sequentialOutputs.map(convertToThinkingStep);
  const conclusion = extractConclusion(thinkingSteps);
  const confidence = estimateConfidence(thinkingSteps);
  const cause = generateHypothesisCause(thinkingSteps);
  const affectedCode = suggestAffectedCode(thinkingSteps);
  
  // Suggest next action based on confidence and thinking completeness
  let suggestedNextAction: 'iterate' | 'pivot' | 'research' | 'fixed';
  if (confidence >= 90) {
    suggestedNextAction = 'iterate';
  } else if (confidence >= 70) {
    suggestedNextAction = 'research';
  } else if (thinkingSteps.some(s => s.isRevision && s.revisesThought === 1)) {
    suggestedNextAction = 'pivot';
  } else {
    suggestedNextAction = 'research';
  }
  
  return {
    thinkingSteps,
    hypothesis: {
      cause,
      affectedCode,
      confidence,
      thoughtConclusion: conclusion
    },
    suggestedNextAction
  };
}