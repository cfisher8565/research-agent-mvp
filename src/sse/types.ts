/**
 * SSE Types for Research Agent Streaming
 * Provides real-time progress updates for long-running research operations
 */

import { Response } from 'express';

export interface SSEProgressCallbacks {
  onProgress?: (message: string) => void;
  onToolUse?: (toolName: string, toolInput: any) => void;
  onToolResult?: (toolName: string, result: any, error?: string) => void;
  onThinking?: (text: string) => void;
  onStreamChunk?: (chunk: string) => void;
  onCacheHit?: (tokens: number) => void;
}

export type SSEEventType =
  | 'metadata'
  | 'progress'
  | 'tool_use'
  | 'tool_result'
  | 'thinking'
  | 'stream_chunk'
  | 'cache_hit'
  | 'result'
  | 'done'
  | 'error'
  | 'server_shutdown';

export interface SSEEvent<T = any> {
  event: SSEEventType;
  data: T;
  timestamp?: number;
}

export interface SSEMetadata {
  sessionId: string;
  timestamp: string;
  historyLength: number;
  agentType: 'research' | 'browser';
}

export interface SSEProgress {
  message: string;
  timestamp: number;
}

export interface SSEToolUse {
  tool: string;
  input: any;
  timestamp: number;
}

export interface SSEToolResult {
  tool: string;
  result: any | null;
  error?: string;
  timestamp: number;
}

export interface SSECacheHit {
  tokens: number;
  savings: string;
  timestamp: number;
}

export interface SSEResult {
  text: string;
  sessionId: string;
  elapsed_ms: number;
}

export interface SSEDone {
  success: boolean;
  elapsed_ms: number;
  historyLength: number;
  toolsUsed?: string[];
}

export interface SSEError {
  message: string;
  elapsed_ms: number;
}

export interface SSEConnection {
  res: Response;
  sessionId: string;
  startTime: number;
  keepAliveInterval?: NodeJS.Timeout;
  isAlive: boolean;
  toolsUsed: string[];
}