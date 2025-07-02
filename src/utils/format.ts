import chalk from 'chalk';
import { CodeThinkingStep, Problem } from '../types/debug.js';

export function formatDebugStep(step: CodeThinkingStep, sessionProblem?: Problem): string {
  const { hypothesis, experiment, result } = step;
  const problem = step.problem || sessionProblem;

  let status = '🔍 Investigating';
  let statusColor = chalk.yellow;

  if (result) {
    if (result.success) {
      status = '✅ Fixed';
      statusColor = chalk.green;
    } else if (step.nextAction === 'iterate') {
      status = '🔄 Iterating';
      statusColor = chalk.blue;
    } else if (step.nextAction === 'pivot') {
      status = '🔀 Pivoting';
      statusColor = chalk.magenta;
    }
  }

  const confidence = hypothesis?.confidence ?? 0;
  const header = statusColor(`${status} | Confidence: ${confidence}%`);
  const border = '═'.repeat(60);

  let output = `
╔${border}╗
║ ${header.padEnd(58)} ║
╟${border}╢`;

  if (problem) {
    output += `\n║ ${chalk.bold('Problem:')} ${problem.description.substring(0, 49).padEnd(49)} ║`;
    if (problem.errorMessage) {
      output += `\n║ ${chalk.red('Error:')} ${problem.errorMessage.substring(0, 51).padEnd(51)} ║`;
    }
  }

  if (hypothesis) {
    output += `\n║ ${chalk.bold('Hypothesis:')} ${hypothesis.cause.substring(0, 45).padEnd(45)} ║`;
    output += `\n║ ${chalk.bold('Affected:')} ${hypothesis.affectedCode.join(', ').substring(0, 47).padEnd(47)} ║`;
  }

  if (experiment && experiment.changes.length > 0) {
    output += `\n╟${border}╢`;
    experiment.changes.forEach((change, idx) => {
      output += `
║ ${chalk.cyan(`Change ${idx + 1}:`)} ${change.file} (lines ${change.lineRange[0]}-${change.lineRange[1]}) ║
║ ${chalk.dim('Reason:')} ${change.reasoning.substring(0, 49).padEnd(49)} ║`;
    });
  }

  if (result) {
    output += `
╟${border}╢
║ ${chalk.bold('Result:')} ${result.success ? chalk.green('Success') : chalk.red('Failed')} ║
║ ${chalk.bold('Learning:')} ${result.learning.substring(0, 47).padEnd(47)} ║`;
  }

  output += `
╚${border}╝`;

  return output;
}

export function createJsonResponse(data: any, error?: boolean): {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
} {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }],
    ...(error && { isError: true })
  };
}