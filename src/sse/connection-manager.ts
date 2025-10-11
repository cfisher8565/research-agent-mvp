/**
 * SSE Connection Manager for Research Agent
 * Handles multiple concurrent SSE connections with automatic cleanup
 */

import { Response } from 'express';
import { SSEConnection, SSEEventType } from './types';

export class SSEConnectionManager {
  private connections = new Map<string, SSEConnection>();
  private readonly MAX_CONNECTIONS = 50;
  private readonly KEEP_ALIVE_INTERVAL = 15000; // 15 seconds

  /**
   * Add a new SSE connection
   */
  add(sessionId: string, res: Response): boolean {
    if (this.connections.size >= this.MAX_CONNECTIONS) {
      console.log(`[SSE] Connection limit reached (${this.MAX_CONNECTIONS})`);
      return false;
    }

    // Close existing connection for this session
    this.close(sessionId);

    const connection: SSEConnection = {
      res,
      sessionId,
      startTime: Date.now(),
      isAlive: true,
      toolsUsed: []
    };

    // Set up keep-alive to prevent timeout
    connection.keepAliveInterval = setInterval(() => {
      if (connection.isAlive && !res.writableEnded) {
        try {
          res.write(': keep-alive\n\n');
        } catch (error) {
          console.error(`[SSE] Keep-alive failed for ${sessionId}:`, error);
          this.close(sessionId);
        }
      }
    }, this.KEEP_ALIVE_INTERVAL);

    this.connections.set(sessionId, connection);
    console.log(`[SSE] Connection added: ${sessionId} (total: ${this.connections.size})`);
    return true;
  }

  /**
   * Send an SSE event to a specific session
   */
  sendEvent(sessionId: string, eventType: SSEEventType, data: any): boolean {
    const connection = this.connections.get(sessionId);
    if (!connection || !connection.isAlive || connection.res.writableEnded) {
      return false;
    }

    try {
      // Track tool usage for final summary
      if (eventType === 'tool_use' && data.tool) {
        connection.toolsUsed.push(data.tool);
      }

      // Send the SSE event
      connection.res.write(`event: ${eventType}\n`);
      connection.res.write(`data: ${JSON.stringify(data)}\n\n`);

      return true;
    } catch (error) {
      console.error(`[SSE] Error sending event to ${sessionId}:`, error);
      this.close(sessionId);
      return false;
    }
  }

  /**
   * Send progress with AGENT:RMT prefix for visibility
   */
  sendProgress(sessionId: string, message: string): boolean {
    const elapsed = this.getElapsedTime(sessionId);
    return this.sendEvent(sessionId, 'progress', {
      message: `[AGENT:RMT-RESEARCH] ${message}`,
      timestamp: elapsed
    });
  }

  /**
   * Get elapsed time for a connection
   */
  getElapsedTime(sessionId: string): number {
    const connection = this.connections.get(sessionId);
    if (!connection) return 0;
    return Date.now() - connection.startTime;
  }

  /**
   * Get tools used in this session
   */
  getToolsUsed(sessionId: string): string[] {
    const connection = this.connections.get(sessionId);
    return connection?.toolsUsed || [];
  }

  /**
   * Close a specific connection
   */
  close(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    connection.isAlive = false;

    if (connection.keepAliveInterval) {
      clearInterval(connection.keepAliveInterval);
    }

    if (!connection.res.writableEnded) {
      try {
        connection.res.end();
      } catch (error) {
        console.error(`[SSE] Error closing connection ${sessionId}:`, error);
      }
    }

    this.connections.delete(sessionId);
    console.log(`[SSE] Connection closed: ${sessionId} (remaining: ${this.connections.size})`);
  }

  /**
   * Close all connections (for shutdown)
   */
  closeAll(): void {
    console.log(`[SSE] Closing ${this.connections.size} connections...`);

    for (const [sessionId, connection] of this.connections) {
      // Send shutdown notification
      this.sendEvent(sessionId, 'server_shutdown', {
        message: 'Server shutting down, please reconnect'
      });
      this.close(sessionId);
    }
  }

  /**
   * Get active connection count
   */
  getActiveCount(): number {
    return this.connections.size;
  }

  /**
   * Check if a session has an active connection
   */
  has(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const stats = {
      activeConnections: this.connections.size,
      maxConnections: this.MAX_CONNECTIONS,
      sessions: [] as any[]
    };

    for (const [sessionId, connection] of this.connections) {
      stats.sessions.push({
        sessionId,
        duration_ms: Date.now() - connection.startTime,
        toolsUsed: connection.toolsUsed.length,
        isAlive: connection.isAlive
      });
    }

    return stats;
  }
}

// Export singleton instance
export const sseConnectionManager = new SSEConnectionManager();