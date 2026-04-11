/**
 * Browser-only Faust MCP server implementation.
 *
 * This is a pure TypeScript/JavaScript implementation that runs entirely in the browser,
 * without requiring Python or Node.js. It implements the MCP protocol in the browser
 * and communicates directly with the Faust runtime.
 *
 * Key differences from the Python server:
 * - No HTTP server needed (can be served as static files)
 * - Direct access to Faust runtime (no bridge/polling)
 * - Can use WebWorker or SharedWorker for MCP protocol handling
 * - All communication happens within the browser environment
 */
interface McpRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: any;
}
interface McpResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}
/**
 * Browser-based MCP server for Faust DSP.
 * Implements the MCP protocol entirely in the browser.
 */
export declare class FaustBrowserMcpServer {
    private runtime;
    private docStore;
    private requestHandlers;
    constructor(runtime: any);
    /**
     * Initialize the documentation store from a URL.
     */
    initDocStore(docIndexUrl: string): Promise<void>;
    /**
     * Register all MCP tool handlers.
     */
    private registerTools;
    /**
     * Handle MCP initialize request.
     */
    private handleInitialize;
    /**
     * Handle tools/list request - return available tools.
     */
    private handleToolsList;
    /**
     * Handle tools/call request - execute a tool.
     */
    private handleToolCall;
    /**
     * Map MCP tool arguments to positional runtime calls.
     * The browser runtime uses snake_case method names and positional arguments.
     */
    private callRuntimeTool;
    /**
     * Handle an incoming MCP request.
     */
    handleRequest(request: McpRequest): Promise<McpResponse>;
    /**
     * Process MCP messages from various transport mechanisms.
     * This can be used with WebSocket, postMessage, etc.
     */
    processMessage(message: string): Promise<string>;
}
/**
 * Create and initialize a browser-based MCP server.
 */
export declare function createBrowserMcpServer(runtime: any, docIndexUrl?: string): Promise<FaustBrowserMcpServer>;
export {};
//# sourceMappingURL=faust_browser_mcp.d.ts.map