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
import { FaustDocStore, searchFaustLib, getFaustSymbol, listFaustModule, getFaustExamples, explainFaustSymbolForGoal, } from './faust_doc_tools.js';
/**
 * Browser-based MCP server for Faust DSP.
 * Implements the MCP protocol entirely in the browser.
 */
export class FaustBrowserMcpServer {
    constructor(runtime) {
        this.docStore = null;
        this.requestHandlers = new Map();
        this.runtime = runtime;
        this.registerTools();
    }
    /**
     * Initialize the documentation store from a URL.
     */
    async initDocStore(docIndexUrl) {
        try {
            this.docStore = await FaustDocStore.fromUrl(docIndexUrl);
        }
        catch (error) {
            console.warn('Failed to load Faust documentation index:', error);
            this.docStore = null;
        }
    }
    /**
     * Register all MCP tool handlers.
     */
    registerTools() {
        // Runtime tools (delegate to Faust runtime)
        this.requestHandlers.set('tools/call', this.handleToolCall.bind(this));
        this.requestHandlers.set('tools/list', this.handleToolsList.bind(this));
        this.requestHandlers.set('initialize', this.handleInitialize.bind(this));
    }
    /**
     * Handle MCP initialize request.
     */
    async handleInitialize(params) {
        return {
            protocolVersion: '2024-11-05',
            serverInfo: {
                name: 'faust-browser-mcp',
                version: '1.0.0',
            },
            capabilities: {
                tools: {},
            },
        };
    }
    /**
     * Handle tools/list request - return available tools.
     */
    async handleToolsList() {
        const tools = [
            {
                name: 'compile_and_start',
                description: 'Compile Faust DSP code and start audio playback in the browser.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        faust_code: { type: 'string', description: 'Faust DSP code to compile' },
                        name: { type: 'string', description: 'Name for this DSP' },
                        latency_hint: { type: 'string', enum: ['interactive', 'balanced', 'playback'] },
                        input_source: { type: 'string', enum: ['none', 'sine', 'noise', 'file'] },
                        input_freq: { type: 'number', description: 'Frequency for sine input' },
                        input_file: { type: 'string', description: 'Path to audio file for input' },
                        hide_meters: { type: 'boolean', description: 'Hide audio meters in UI' },
                        double_precision: { type: 'boolean', description: 'Use double precision' },
                    },
                    required: ['faust_code'],
                },
            },
            {
                name: 'compile',
                description: 'Compile Faust DSP code without starting audio.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        faust_code: { type: 'string', description: 'Faust DSP code to compile' },
                        name: { type: 'string' },
                        latency_hint: { type: 'string' },
                        input_source: { type: 'string' },
                        input_freq: { type: 'number' },
                        input_file: { type: 'string' },
                        hide_meters: { type: 'boolean' },
                        double_precision: { type: 'boolean' },
                    },
                    required: ['faust_code'],
                },
            },
            {
                name: 'start',
                description: 'Start audio playback of compiled DSP.',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'stop',
                description: 'Stop audio playback.',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'destroy',
                description: 'Destroy the current DSP instance.',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'check_syntax',
                description: 'Validate Faust syntax without compiling.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        faust_code: { type: 'string', description: 'Faust code to validate' },
                        name: { type: 'string' },
                        double_precision: { type: 'boolean' },
                    },
                    required: ['faust_code'],
                },
            },
            {
                name: 'get_status',
                description: 'Get current runtime status.',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'get_params',
                description: 'Get all DSP parameters.',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'get_param',
                description: 'Get a specific parameter value.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Parameter path' },
                    },
                    required: ['path'],
                },
            },
            {
                name: 'set_param',
                description: 'Set a parameter value.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Parameter path' },
                        value: { type: 'number', description: 'Parameter value' },
                    },
                    required: ['path', 'value'],
                },
            },
            {
                name: 'get_param_values',
                description: 'Get all parameter values.',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'set_param_values',
                description: 'Set multiple parameter values.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        values: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    path: { type: 'string' },
                                    value: { type: 'number' },
                                },
                            },
                        },
                    },
                    required: ['values'],
                },
            },
            {
                name: 'get_audio_metrics',
                description: 'Get audio metrics including meters, scope, and spectrum data.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        include_scope: { type: 'boolean' },
                        include_spectrum: { type: 'boolean' },
                        per_channel: { type: 'boolean' },
                        fft_size: { type: 'number' },
                        smoothing: { type: 'number' },
                        min_db: { type: 'number' },
                        max_db: { type: 'number' },
                        edge_threshold: { type: 'number' },
                        log_bins: { type: 'boolean' },
                    },
                },
            },
            {
                name: 'get_midi_inputs',
                description: 'Get available MIDI input devices.',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'select_midi_input',
                description: 'Select a MIDI input device.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        index: { type: 'number' },
                        name: { type: 'string' },
                    },
                },
            },
            {
                name: 'get_midi_status',
                description: 'Get MIDI status and activity.',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'unlock_audio',
                description: 'Unlock audio context (requires user gesture).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        latency_hint: { type: 'string' },
                    },
                },
            },
            {
                name: 'load_wasm_module',
                description: 'Load a precompiled WASM module.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        wasm_base64: { type: 'string' },
                        wasm_path: { type: 'string' },
                        dsp_json: { type: 'string' },
                        dsp_json_path: { type: 'string' },
                        effect_wasm_base64: { type: 'string' },
                        effect_wasm_path: { type: 'string' },
                        effect_dsp_json: { type: 'string' },
                        effect_dsp_json_path: { type: 'string' },
                        name: { type: 'string' },
                        latency_hint: { type: 'string' },
                    },
                },
            },
            {
                name: 'save_wasm_module',
                description: 'Save compiled WASM module as base64.',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'get_dsp_json',
                description: 'Get DSP metadata JSON.',
                inputSchema: { type: 'object', properties: {} },
            },
        ];
        // Add documentation tools if doc store is available
        if (this.docStore) {
            tools.push({
                name: 'search_faust_lib',
                description: 'Search Faust library documentation.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                        limit: { type: 'number', description: 'Max results' },
                        module: { type: 'string', description: 'Filter by module' },
                    },
                    required: ['query'],
                },
            }, {
                name: 'get_faust_symbol',
                description: 'Get documentation for a specific Faust symbol.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        symbol: { type: 'string', description: 'Symbol name' },
                    },
                    required: ['symbol'],
                },
            }, {
                name: 'list_faust_module',
                description: 'List all symbols in a Faust module.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        module: { type: 'string', description: 'Module name' },
                        limit: { type: 'number', description: 'Max results' },
                    },
                    required: ['module'],
                },
            }, {
                name: 'get_faust_examples',
                description: 'Get example code for a symbol or module.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        symbol_or_module: { type: 'string', description: 'Symbol or module name' },
                        limit: { type: 'number', description: 'Max examples' },
                    },
                    required: ['symbol_or_module'],
                },
            }, {
                name: 'explain_faust_symbol_for_goal',
                description: 'Get goal-oriented explanation of a Faust symbol.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        symbol: { type: 'string', description: 'Symbol name' },
                        goal: { type: 'string', description: 'User goal' },
                    },
                    required: ['symbol', 'goal'],
                },
            });
        }
        return { tools };
    }
    /**
     * Handle tools/call request - execute a tool.
     */
    async handleToolCall(params) {
        const { name, arguments: args } = params;
        try {
            // Documentation tools
            if (name === 'search_faust_lib') {
                if (!this.docStore)
                    throw new Error('Documentation not available');
                const result = await searchFaustLib(this.docStore, args.query, args.limit, args.module);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            if (name === 'get_faust_symbol') {
                if (!this.docStore)
                    throw new Error('Documentation not available');
                const result = await getFaustSymbol(this.docStore, args.symbol);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            if (name === 'list_faust_module') {
                if (!this.docStore)
                    throw new Error('Documentation not available');
                const result = await listFaustModule(this.docStore, args.module, args.limit);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            if (name === 'get_faust_examples') {
                if (!this.docStore)
                    throw new Error('Documentation not available');
                const result = await getFaustExamples(this.docStore, args.symbol_or_module, args.limit);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            if (name === 'explain_faust_symbol_for_goal') {
                if (!this.docStore)
                    throw new Error('Documentation not available');
                const result = await explainFaustSymbolForGoal(this.docStore, args.symbol, args.goal);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            // Runtime tools - delegate to the Faust runtime with positional args
            const result = await this.callRuntimeTool(name, args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        catch (error) {
            throw new Error(error.message || 'Tool execution failed');
        }
    }
    /**
     * Map MCP tool arguments to positional runtime calls.
     * The browser runtime uses snake_case method names and positional arguments.
     */
    async callRuntimeTool(name, args) {
        const a = args || {};
        switch (name) {
            case 'compile_and_start':
                return this.runtime.compile_and_start(a.faust_code, a.name, a.latency_hint, a.input_source, a.input_freq, a.input_file, a.hide_meters, a.double_precision);
            case 'compile':
                return this.runtime.compile(a.faust_code, a.name, a.latency_hint, a.input_source, a.input_freq, a.input_file, a.hide_meters, a.double_precision);
            case 'check_syntax':
                return this.runtime.check_syntax(a.faust_code, a.name, a.double_precision);
            case 'start':
                return this.runtime.start();
            case 'stop':
                return this.runtime.stop();
            case 'destroy':
                return this.runtime.destroy();
            case 'get_status':
                return this.runtime.get_status();
            case 'get_params':
                return this.runtime.get_params();
            case 'get_param':
                return this.runtime.get_param(a.path);
            case 'set_param':
                return this.runtime.set_param(a.path, a.value);
            case 'get_param_values':
                return this.runtime.get_param_values();
            case 'set_param_values':
                return this.runtime.set_param_values(a.values);
            case 'get_audio_metrics':
                return this.runtime.get_audio_metrics(a.include_scope, a.include_spectrum, a.per_channel, a.fft_size, a.smoothing, a.min_db, a.max_db, a.edge_threshold, a.log_bins);
            case 'get_midi_inputs':
                return this.runtime.get_midi_inputs();
            case 'select_midi_input':
                return this.runtime.select_midi_input(a.index, a.name);
            case 'get_midi_status':
                return this.runtime.get_midi_status();
            case 'unlock_audio':
                return this.runtime.unlock_audio(a.latency_hint);
            case 'load_wasm_module':
                return this.runtime.load_wasm_module(a);
            case 'save_wasm_module':
                return this.runtime.save_wasm_module();
            case 'get_dsp_json':
                return this.runtime.get_dsp_json();
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    /**
     * Handle an incoming MCP request.
     */
    async handleRequest(request) {
        const { id, method, params } = request;
        try {
            const handler = this.requestHandlers.get(method);
            if (!handler) {
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${method}`,
                    },
                };
            }
            const result = await handler(params);
            return {
                jsonrpc: '2.0',
                id,
                result,
            };
        }
        catch (error) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32603,
                    message: error.message || 'Internal error',
                    data: error.stack,
                },
            };
        }
    }
    /**
     * Process MCP messages from various transport mechanisms.
     * This can be used with WebSocket, postMessage, etc.
     */
    async processMessage(message) {
        try {
            const request = JSON.parse(message);
            const response = await this.handleRequest(request);
            return JSON.stringify(response);
        }
        catch (error) {
            return JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: -32700,
                    message: 'Parse error',
                    data: error.message,
                },
            });
        }
    }
}
/**
 * Create and initialize a browser-based MCP server.
 */
export async function createBrowserMcpServer(runtime, docIndexUrl) {
    const server = new FaustBrowserMcpServer(runtime);
    if (docIndexUrl) {
        await server.initDocStore(docIndexUrl);
    }
    return server;
}
//# sourceMappingURL=faust_browser_mcp.js.map