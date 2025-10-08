/**
 * Direct HTTP client for MCP Servers App (Streamable HTTP transport)
 *
 * The Claude Agent SDK only supports stdio MCP servers, not HTTP.
 * This wrapper makes direct HTTP calls to our deployed MCP servers.
 */

import axios from 'axios';

const MCP_SERVER_URL = process.env.MCP_SERVERS_URL || 'https://mcp-servers-app-ng8oh.ondigitalocean.app/mcp';

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Call an MCP tool via Streamable HTTP transport
 */
export async function callMCPTool(toolName: string, args: any): Promise<any> {
  try {
    // Streamable HTTP requires SSE Accept header
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };

    // List tools first to verify availability
    const listResponse = await axios.post<MCPResponse>(MCP_SERVER_URL, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    }, { headers });

    if (listResponse.data.error) {
      throw new Error(`MCP tools/list failed: ${listResponse.data.error.message}`);
    }

    // Call the specific tool
    const callResponse = await axios.post<MCPResponse>(MCP_SERVER_URL, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    }, { headers });

    if (callResponse.data.error) {
      throw new Error(`MCP tool ${toolName} failed: ${callResponse.data.error.message}`);
    }

    return callResponse.data.result;
  } catch (error: any) {
    throw new Error(`MCP HTTP call failed: ${error.message}`);
  }
}

/**
 * Available MCP tools (10 total)
 */
export const MCP_TOOLS = {
  // Context7 (2 tools)
  context7: {
    resolveLibraryId: async (libraryName: string) =>
      callMCPTool('mcp__context7__resolve-library-id', { libraryName }),

    getLibraryDocs: async (libraryId: string, topic?: string, tokens?: number) =>
      callMCPTool('mcp__context7__get-library-docs', {
        context7CompatibleLibraryID: libraryId,
        topic,
        tokens
      })
  },

  // Perplexity (4 tools)
  perplexity: {
    search: async (query: string) =>
      callMCPTool('perplexity_search', { query }),

    ask: async (query: string) =>
      callMCPTool('perplexity_ask', { query }),

    research: async (query: string) =>
      callMCPTool('perplexity_research', { query }),

    reason: async (query: string) =>
      callMCPTool('perplexity_reason', { query })
  },

  // BrightData (4 tools)
  brightdata: {
    searchEngine: async (query: string, engine?: 'google' | 'bing' | 'yandex') =>
      callMCPTool('mcp__brightdata__search_engine', { query, engine }),

    scrapeAsMarkdown: async (url: string) =>
      callMCPTool('mcp__brightdata__scrape_as_markdown', { url }),

    scrapeBatch: async (urls: string[]) =>
      callMCPTool('mcp__brightdata__scrape_batch', { urls }),

    searchEngineBatch: async (queries: Array<{query: string, engine?: string}>) =>
      callMCPTool('mcp__brightdata__search_engine_batch', { queries })
  }
};

/**
 * Test all MCP tools are accessible
 */
export async function testMCPConnection(): Promise<{success: boolean, toolCount: number, tools: string[]}> {
  try {
    const response = await axios.post<MCPResponse>(MCP_SERVER_URL, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      }
    });

    if (response.data.error) {
      return { success: false, toolCount: 0, tools: [] };
    }

    const tools = response.data.result?.tools || [];
    return {
      success: true,
      toolCount: tools.length,
      tools: tools.map((t: any) => t.name)
    };
  } catch (error) {
    return { success: false, toolCount: 0, tools: [] };
  }
}
