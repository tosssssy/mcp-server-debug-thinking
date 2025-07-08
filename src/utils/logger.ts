import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export class Logger {
  private level: LogLevel;
  private disableLogging: boolean;

  constructor() {
    this.disableLogging = (process.env.DISABLE_DEBUG_LOGGING || '').toLowerCase() === 'true';
    this.level = this.disableLogging ? LogLevel.NONE : LogLevel.INFO;
    
    // ログレベルのオーバーライドを許可
    const envLevel = process.env.DEBUG_LOG_LEVEL?.toUpperCase();
    if (envLevel && envLevel in LogLevel) {
      this.level = LogLevel[envLevel as keyof typeof LogLevel] as LogLevel;
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.error(chalk.gray(`[DEBUG] ${message}`), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.error(message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.error(chalk.yellow(message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(chalk.red(message), ...args);
    }
  }

  success(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.error(chalk.green(message), ...args);
    }
  }

  dim(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.error(chalk.dim(message), ...args);
    }
  }

  bold(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.error(chalk.bold(message), ...args);
    }
  }

  session(action: 'start' | 'end', sessionId: string): void {
    if (this.level <= LogLevel.INFO) {
      if (action === 'start') {
        console.error(chalk.bold.blue(`\n🚀 Started debug session: ${sessionId}\n`));
      } else {
        console.error(chalk.bold.red(`\n🏁 Ended debug session: ${sessionId}\n`));
      }
    }
  }

  search(query: any, resultCount: number): void {
    if (this.level <= LogLevel.INFO) {
      console.error(chalk.cyan(`🔍 Searching with query:`), query);
      console.error(chalk.green(`✓ Found ${resultCount} matches`));
    }
  }
}

export const logger = new Logger();