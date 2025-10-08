#!/usr/bin/env node
/**
 * stdio → HTTP MCP Proxy Server
 *
 * Bridges Claude Agent SDK (stdio only) to our HTTP MCP servers.
 * Reads JSON-RPC from stdin, forwards to HTTP, writes response to stdout.
 */

import { stdin, stdout } from 'process';
import axios from 'axios';
import { createInterface } from 'readline';

const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp';

// Read JSON-RPC messages from stdin
const rl = createInterface({
  input: stdin,
  output: process.stderr, // Errors to stderr, responses to stdout
  terminal: false
});

rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);

    // Forward to HTTP MCP server (Streamable HTTP requires SSE Accept header)
    const response = await axios.post(MCP_SERVER_URL, request, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      timeout: 30000
    });

    // Write JSON-RPC response to stdout
    stdout.write(JSON.stringify(response.data) + '\n');
  } catch (error: any) {
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

console.error('[MCP Proxy] Started - forwarding stdio to HTTP:', MCP_SERVER_URL);
