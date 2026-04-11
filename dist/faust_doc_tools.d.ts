/**
 * Local Faust library documentation lookup helpers for faustbrowser-mcp.
 *
 * This module provides TypeScript implementation of the documentation lookup logic
 * from the `faustlibraries` repository, adapted for browser use.
 *
 * Scope:
 * - split-layout Faust documentation index only
 * - lazy loading of detailed module JSON files
 * - symbol search, lookup, module listing, examples, and goal-oriented explain
 */
interface Source {
    file?: string;
    path?: string;
    line?: number;
}
interface Symbol {
    id?: string;
    name?: string;
    qualifiedName?: string;
    summary?: string;
    usage?: string;
    source?: Source;
    testCode?: string;
    params?: Array<{
        name: string;
        description: string;
    }>;
    notes?: string[];
}
interface Library {
    file?: string;
    path?: string;
    aliasHints?: string[];
    moduleDoc?: string;
}
/**
 * Access wrapper around the split Faust documentation index layout.
 */
export declare class FaustDocStore {
    private index;
    private baseUrl;
    private moduleCache;
    private libraryByPath;
    private constructor();
    /**
     * Load a split index from a URL or path.
     */
    static fromUrl(indexUrl: string): Promise<FaustDocStore>;
    /**
     * Return the compact top-level symbol list from the split index.
     */
    compactSymbols(): Symbol[];
    /**
     * Load one detailed module JSON and cache the Promise to dedupe concurrent loads.
     */
    private loadModuleDocument;
    /**
     * Resolve a module name, path stem, or alias to its library entry.
     */
    getLibrary(module: string): Library | null;
    /**
     * Return one library descriptor plus its full symbol entries.
     */
    getLibrarySymbols(module: string): Promise<[Library | null, Symbol[]]>;
    /**
     * Expand one compact top-level symbol summary into the full symbol entry.
     */
    getSymbolBySummary(summarySymbol: Symbol): Promise<Symbol>;
    /**
     * Find the best symbol match plus alternative compact matches.
     */
    findSymbol(symbolInput: string): Promise<[Symbol | null, Symbol[]]>;
}
/**
 * Search compact symbol summaries by text, optionally restricted to one module.
 */
export declare function searchFaustLib(store: FaustDocStore, query: string, limit?: number, module?: string): Promise<any>;
/**
 * Return the full symbol entry plus nearby alternatives.
 */
export declare function getFaustSymbol(store: FaustDocStore, symbol: string): Promise<any>;
/**
 * List lightweight symbol summaries from one module.
 */
export declare function listFaustModule(store: FaustDocStore, module: string, limit?: number): Promise<any>;
/**
 * Return `testCode` snippets for a module or a symbol.
 */
export declare function getFaustExamples(store: FaustDocStore, symbolOrModule: string, limit?: number): Promise<any>;
/**
 * Compose a short action-oriented explanation from one symbol entry.
 */
export declare function explainFaustSymbolForGoal(store: FaustDocStore, symbol: string, goal: string): Promise<any>;
export {};
//# sourceMappingURL=faust_doc_tools.d.ts.map