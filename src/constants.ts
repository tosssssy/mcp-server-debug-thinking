// File paths
export const DATA_DIR_NAME = '.debug-iteration-mcp';
export const METADATA_FILE = 'metadata.json';

// JSONL file paths
export const SESSIONS_JSONL_FILE = 'sessions.jsonl';
export const ERROR_PATTERNS_JSONL_FILE = 'error-patterns.jsonl';
export const SUCCESSFUL_FIXES_JSONL_FILE = 'successful-fixes.jsonl';

// Search defaults
export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;
export const MIN_SEARCH_LIMIT = 1;
export const DEFAULT_SEARCH_MODE = 'fuzzy';
export const DEFAULT_KEYWORD_LOGIC = 'OR';

// Scoring weights
export const ERROR_TYPE_EXACT_MATCH_SCORE = 0.4;
export const ERROR_TYPE_PARTIAL_MATCH_SCORE = 0.25;
export const ERROR_TYPE_SIMILARITY_THRESHOLD = 0.7;
export const KEYWORD_MATCH_SCORE = 0.5;
export const KEYWORD_AND_PARTIAL_SCORE = 0.3;
export const METADATA_ONLY_BASE_SCORE = 0.3;
export const DEFAULT_BASE_SCORE = 0.1;
export const RECENT_SESSION_BOOST = 0.1;
export const RECENT_SESSION_DAYS = 7;
export const SOMEWHAT_RECENT_SESSION_BOOST = 0.05;
export const SOMEWHAT_RECENT_SESSION_DAYS = 30;
export const HIGH_SUCCESS_RATE_THRESHOLD = 0.8;
export const HIGH_SUCCESS_RATE_BOOST = 0.1;
export const HIGH_SIMILARITY_THRESHOLD = 0.7;

// Error messages
export const ERROR_MESSAGES = {
  NO_ACTIVE_SESSION: 'No active session',
  SESSION_NOT_FOUND: 'Session not found',
  INVALID_SEARCH_QUERY: 'Invalid search query. Please provide a valid SearchQuery object.',
  NO_SEARCH_CRITERIA: 'Search query must include at least one search criterion (errorType, keywords, language, framework, or confidence_threshold).',
  INVALID_LIMIT: 'Limit must be between 1 and 50.',
  UNKNOWN_ACTION: 'Unknown action',
  SEARCH_QUERY_REQUIRED: 'searchQuery is required for search_patterns action',
  NO_SESSION_TO_END: 'No session to end',
  AT_LEAST_ONE_FIELD_REQUIRED: 'At least one of: problem, hypothesis, experiment, or result must be provided',
};

// Tool metadata
export const TOOL_NAME = 'debug_iteration';
export const SERVER_NAME = 'debug-iteration-server';
export const SERVER_VERSION = '0.2.0';

// Actions
export const ACTIONS = {
  START: 'start',
  THINK: 'think',
  EXPERIMENT: 'experiment',
  OBSERVE: 'observe',
  SEARCH: 'search',
  END: 'end',
} as const;

export type ActionType = typeof ACTIONS[keyof typeof ACTIONS];