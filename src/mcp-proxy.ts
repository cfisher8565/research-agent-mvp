#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED - stdio → HTTP MCP Proxy Server
 *
 * This proxy is NO LONGER NEEDED as of October 1, 2025.
 * Claude Agent SDK now supports native HTTP MCP connections.
 *
 * Previously: Bridged Claude Agent SDK (stdio only) to HTTP MCP servers.
 * Now: Use native HTTP support in src/server.ts instead.
 *
 * This file is kept for reference only.
 */

import { stdin, stdout } from 'process';
import axios from 'axios';
import { createInterface } from 'readline';

const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp';

let messageId = 0;

// Read JSON-RPC messages from stdin
const rl = createInterface({
  input: stdin,
  output: process.stderr,
  terminal: false
});

rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    const requestId = request.id || ++messageId;

    console.error(`[MCP Proxy] Request ${requestId}: ${request.method}`);

    // Forward to HTTP MCP server (Streamable HTTP requires SSE Accept header)
    const response = await axios.post(MCP_SERVER_URL, request, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      timeout: 60000, // Increase timeout for research queries
      validateStatus: () => true // Accept all status codes
    });

    // Handle initialization response
    if (request.method === 'initialize') {
      console.error('[MCP Proxy] Initialization successful');
    }

    // Write JSON-RPC response to stdout
    if (response.data) {
      stdout.write(JSON.stringify(response.data) + '\n');
      console.error(`[MCP Proxy] Response ${requestId}: success`);
    } else {
      throw new Error('Empty response from MCP server');
    }
  } catch (error: any) {
    console.error('[MCP Proxy] Error:', error.message);
    // Write error response
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: error.message || 'Proxy error'
      }
    };
    stdout.write(JSON.stringify(errorResponse) + '\n');
  }
});

rl.on('close', () => {
  console.error('[MCP Proxy] stdin closed, exiting');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error('[MCP Proxy] SIGINT received, exiting');
  process.exit(0);
});

console.error('[MCP Proxy] Started - forwarding stdio to HTTP:', MCP_SERVER_URL);
