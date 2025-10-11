/**
 * SSE Streaming Endpoints for Research Agent
 * Provides real-time progress updates during research operations
 */

import { Request, Response } from 'express';
import { sseConnectionManager } from './connection-manager';
import { sessionManager } from '../session-manager-redis'; // Use Redis session manager
import { runAgentWithToolsAndContextStreaming } from '../agent-direct-enhanced-streaming';
import { RESEARCH_AGENT_SYSTEM_PROMPT } from '../system-prompts';
import { SSEProgressCallbacks } from './types';

/**
 * Handle SSE streaming query endpoint
 */
export async function handleQueryStream(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    const { prompt, sessionId: clientSessionId, context } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: prompt'
      });
    }

    // Generate or use provided session ID
    const sessionId = clientSessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[Query Stream] Session: ${sessionId}, Prompt: ${prompt.substring(0, 100)}...`);

    // Update session context (async for Redis)
    if (context) {
      await sessionManager.updateContext(sessionId, context);
    }

    // Get session history (async for Redis)
    const history = await sessionManager.getHistory(sessionId);
    const sessionContext = await sessionManager.getContext(sessionId);

    // Add user message to session (async for Redis)
    await sessionManager.addMessage(sessionId, 'user', prompt);

    // Set up SSE connection with proper headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Critical for nginx
    });

    // Register connection
    if (!sseConnectionManager.add(sessionId, res)) {
      return res.status(503).json({
        success: false,
        error: 'Server at capacity, please try again later'
      });
    }

    // Cleanup handlers
    req.on('close', () => {
      console.log(`[Query Stream] Client disconnected: ${sessionId}`);
      sseConnectionManager.close(sessionId);
    });

    req.on('error', (err) => {
      console.error(`[Query Stream] Request error for ${sessionId}:`, err);
      sseConnectionManager.close(sessionId);
    });

    // Send initial metadata with AGENT:RMT prefix
    sseConnectionManager.sendEvent(sessionId, 'metadata', {
      sessionId,
      timestamp: new Date().toISOString(),
      historyLength: history.length,
      agentType: 'research',
      agentPrefix: '[AGENT:RMT-RESEARCH]'
    });

    // Send initialization progress
    sseConnectionManager.sendProgress(sessionId, '🔍 Initializing remote research specialist...');
    sseConnectionManager.sendProgress(sessionId, '📡 Connected to DigitalOcean droplet (134.209.170.26)');
    sseConnectionManager.sendProgress(sessionId, '🚀 Starting research with 10 specialized tools...');

    // Create progress callbacks for agent
    const callbacks: SSEProgressCallbacks = {
      onProgress: (message: string) => {
        sseConnectionManager.sendProgress(sessionId, message);
      },
      onToolUse: (toolName: string, toolInput: any) => {
        // Clean tool name for display
        const displayName = toolName.replace(/^mcp__/, '').replace(/__/g, ' > ');
        sseConnectionManager.sendProgress(sessionId, `⚡ Using tool: ${displayName}`);

        sseConnectionManager.sendEvent(sessionId, 'tool_use', {
          tool: toolName,
          displayName,
          input: toolInput,
          timestamp: sseConnectionManager.getElapsedTime(sessionId)
        });
      },
      onToolResult: (toolName: string, result: any, error?: string) => {
        const displayName = toolName.replace(/^mcp__/, '').replace(/__/g, ' > ');

        if (error) {
          sseConnectionManager.sendProgress(sessionId, `⚠️ Tool error: ${displayName}`);
        } else {
          sseConnectionManager.sendProgress(sessionId, `✅ Tool completed: ${displayName}`);
        }

        sseConnectionManager.sendEvent(sessionId, 'tool_result', {
          tool: toolName,
          displayName,
          result: error ? null : result,
          error,
          timestamp: sseConnectionManager.getElapsedTime(sessionId)
        });
      },
      onThinking: (text: string) => {
        sseConnectionManager.sendEvent(sessionId, 'thinking', {
          text,
          timestamp: sseConnectionManager.getElapsedTime(sessionId)
        });
      },
      onStreamChunk: (chunk: string) => {
        sseConnectionManager.sendEvent(sessionId, 'stream_chunk', {
          chunk,
          timestamp: sseConnectionManager.getElapsedTime(sessionId)
        });
      },
      onCacheHit: (tokens: number) => {
        const savings = Math.round(tokens * 0.9); // 90% savings
        sseConnectionManager.sendProgress(sessionId, `💰 Cache hit: ${tokens} tokens (saved ${savings} tokens)`);

        sseConnectionManager.sendEvent(sessionId, 'cache_hit', {
          tokens,
          savings: `${savings} tokens (90% reduction)`,
          timestamp: sseConnectionManager.getElapsedTime(sessionId)
        });
      }
    };

    try {
      // Run agent with streaming callbacks
      const finalResult = await runAgentWithToolsAndContextStreaming(
        prompt,
        history,
        RESEARCH_AGENT_SYSTEM_PROMPT,
        sessionContext,
        callbacks
      );

      // Add assistant response to session (async for Redis)
      await sessionManager.addMessage(sessionId, 'assistant', finalResult);

      const elapsed = Date.now() - startTime;
      const toolsUsed = sseConnectionManager.getToolsUsed(sessionId);

      // Send final result
      sseConnectionManager.sendEvent(sessionId, 'result', {
        text: finalResult,
        sessionId,
        elapsed_ms: elapsed
      });

      // Send completion event with summary
      sseConnectionManager.sendProgress(sessionId, `✅ Research completed successfully in ${(elapsed / 1000).toFixed(1)}s`);
      sseConnectionManager.sendEvent(sessionId, 'done', {
        success: true,
        elapsed_ms: elapsed,
        historyLength: history.length + 2,
        toolsUsed: [...new Set(toolsUsed)] // Unique tools
      });

      console.log(`[Query Stream] Completed in ${elapsed}ms with ${toolsUsed.length} tool calls`);

    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[Query Stream] Error after ${elapsed}ms:`, error.message);

      sseConnectionManager.sendProgress(sessionId, `❌ Error: ${error.message}`);
      sseConnectionManager.sendEvent(sessionId, 'error', {
        message: error.message,
        elapsed_ms: elapsed
      });
    } finally {
      sseConnectionManager.close(sessionId);
    }

  } catch (error: any) {
    console.error(`[Query Stream] Setup error:`, error.message);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

/**
 * Get SSE connection statistics
 */
export async function handleSSEStats(req: Request, res: Response) {
  const stats = sseConnectionManager.getStats();
  res.json({
    success: true,
    data: stats
  });
}