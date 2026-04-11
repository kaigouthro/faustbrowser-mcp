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
  params?: Array<{ name: string; description: string }>;
  notes?: string[];
}

interface Library {
  file?: string;
  path?: string;
  aliasHints?: string[];
  moduleDoc?: string;
}

interface Index {
  layout?: string;
  libraries?: Library[];
  symbols?: Symbol[];
}

/**
 * Load JSON from a URL or path
 */
async function loadJson(path: string): Promise<any> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Map a `.lib` source path to its split-layout module JSON path.
 */
function moduleDocRelpathForSource(sourcePath: string): string {
  const parts = sourcePath.split('/');
  const filename = parts[parts.length - 1];
  const jsonFilename = filename.replace(/\.lib$/, '.json');
  return `modules/${jsonFilename}`;
}

/**
 * Score one symbol against a lowercased free-text query.
 */
function rankSymbolMatch(symbol: Symbol, queryLower: string): number {
  if ((symbol.qualifiedName || '').toLowerCase() === queryLower) {
    return 120;
  }
  if ((symbol.name || '').toLowerCase() === queryLower) {
    return 110;
  }
  if ((symbol.id || '').toLowerCase() === queryLower) {
    return 105;
  }

  let score = 0;
  const haystacks = [
    symbol.name || '',
    symbol.qualifiedName || '',
    symbol.summary || '',
    symbol.source?.file || '',
  ];

  for (const haystack of haystacks) {
    if (haystack.toLowerCase().includes(queryLower)) {
      score += 20;
    }
  }
  return score;
}

/**
 * Normalize a module selector to a lowercase comparable key.
 */
function normalizeModuleKey(module: string): string {
  return (module || '').trim().toLowerCase();
}

/**
 * Access wrapper around the split Faust documentation index layout.
 */
export class FaustDocStore {
  private index: Index;
  private baseUrl: string;
  private moduleCache: Map<string, Promise<any>> = new Map();
  private libraryByPath: Map<string, Library> = new Map();

  private constructor(index: Index, baseUrl: string) {
    this.index = index;
    this.baseUrl = baseUrl;

    if (index.layout !== 'split-v1') {
      throw new Error(
        'faustbrowser-mcp expects a split Faust doc index (layout=split-v1). ' +
        'Generate one with make doc-index-split in faustlibraries.'
      );
    }

    const libraries = index.libraries || [];
    for (const library of libraries) {
      if (library && library.path) {
        this.libraryByPath.set(library.path, library);
      }
    }
  }

  /**
   * Load a split index from a URL or path.
   */
  static async fromUrl(indexUrl: string): Promise<FaustDocStore> {
    const index = await loadJson(indexUrl);
    // Compute base URL by stripping the filename component.
    // Using URL API handles both 'path/to/index.json' and bare 'index.json'.
    let baseUrl: string;
    try {
      const base = typeof location !== 'undefined' ? location.href : undefined;
      const resolved = new URL(indexUrl, base);
      baseUrl = new URL('.', resolved).href.replace(/\/$/, '');
    } catch {
      // Fallback for non-standard URL strings: strip optional slash + index.json
      baseUrl = indexUrl.replace(/\/?index\.json$/, '');
    }
    return new FaustDocStore(index, baseUrl);
  }

  /**
   * Return the compact top-level symbol list from the split index.
   */
  compactSymbols(): Symbol[] {
    return this.index.symbols || [];
  }

  /**
   * Load one detailed module JSON and cache the Promise to dedupe concurrent loads.
   */
  private loadModuleDocument(relpath: string): Promise<any> {
    if (!this.moduleCache.has(relpath)) {
      const url = `${this.baseUrl}/${relpath}`;
      this.moduleCache.set(relpath, loadJson(url));
    }
    return this.moduleCache.get(relpath)!;
  }

  /**
   * Resolve a module name, path stem, or alias to its library entry.
   */
  getLibrary(module: string): Library | null {
    const key = normalizeModuleKey(module);
    const libraries = this.index.libraries || [];

    for (const library of libraries) {
      if (!library) continue;

      const fileName = (library.file || '').toLowerCase();
      const pathName = (library.path || '').toLowerCase();
      const fileStem = fileName.replace(/\.lib$/, '');
      const pathStem = pathName.replace(/\.lib$/, '');
      const aliases = (library.aliasHints || []).map(a => a.toLowerCase());

      if (key === fileStem || key === pathStem || aliases.includes(key)) {
        return library;
      }
    }
    return null;
  }

  /**
   * Return one library descriptor plus its full symbol entries.
   */
  async getLibrarySymbols(module: string): Promise<[Library | null, Symbol[]]> {
    const library = this.getLibrary(module);
    if (library === null) {
      return [null, []];
    }

    const relpath = library.moduleDoc || '';
    const moduleDoc = await this.loadModuleDocument(relpath);
    return [library, moduleDoc.symbols || []];
  }

  /**
   * Expand one compact top-level symbol summary into the full symbol entry.
   */
  async getSymbolBySummary(summarySymbol: Symbol): Promise<Symbol> {
    const source = summarySymbol.source || {};
    const sourcePath = source.path || '';
    const library = this.libraryByPath.get(sourcePath);

    let relpath: string;
    if (library && library.moduleDoc) {
      relpath = library.moduleDoc;
    } else {
      relpath = moduleDocRelpathForSource(sourcePath);
    }

    const moduleDoc = await this.loadModuleDocument(relpath);
    const symbols = moduleDoc.symbols || [];

    for (const symbol of symbols) {
      if ((symbol.id || '').toLowerCase() === (summarySymbol.id || '').toLowerCase()) {
        return symbol;
      }
    }

    throw new Error(`Symbol not found in detailed module document: ${summarySymbol.id}`);
  }

  /**
   * Find the best symbol match plus alternative compact matches.
   */
  async findSymbol(symbolInput: string): Promise<[Symbol | null, Symbol[]]> {
    const key = (symbolInput || '').trim().toLowerCase();
    if (!key) {
      return [null, []];
    }

    // Look for exact match
    const compactSymbols = this.compactSymbols();
    const exactSummary = compactSymbols.find(
      symbol =>
        (symbol.name || '').toLowerCase() === key ||
        (symbol.id || '').toLowerCase() === key ||
        (symbol.qualifiedName || '').toLowerCase() === key
    );

    if (exactSummary) {
      const fullSymbol = await this.getSymbolBySummary(exactSummary);
      return [fullSymbol, []];
    }

    // Rank all symbols
    const ranked = compactSymbols
      .map(symbol => ({
        symbol,
        score: rankSymbolMatch(symbol, key),
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) {
      return [null, []];
    }

    const best = await this.getSymbolBySummary(ranked[0].symbol);
    const alternatives = ranked.slice(1, 6).map(entry => entry.symbol);
    return [best, alternatives];
  }
}

/**
 * Search compact symbol summaries by text, optionally restricted to one module.
 */
export async function searchFaustLib(
  store: FaustDocStore,
  query: string,
  limit: number = 10,
  module?: string
): Promise<any> {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    throw new Error('Missing query');
  }

  const moduleKey = normalizeModuleKey(module || '');
  const ranked: Array<{ symbol: Symbol; score: number }> = [];

  for (const symbol of store.compactSymbols()) {
    if (moduleKey) {
      const sourceFile = ((symbol.source?.file || '').toLowerCase());
      const sourcePath = ((symbol.source?.path || '').toLowerCase());
      const sourceMod = sourceFile.replace(/\.lib$/, '');
      const sourcePathMod = sourcePath.replace(/\.lib$/, '');
      const qualified = (symbol.qualifiedName || '').toLowerCase();

      if (
        sourceMod !== moduleKey &&
        sourcePathMod !== moduleKey &&
        !qualified.startsWith(`${moduleKey}.`)
      ) {
        continue;
      }
    }

    const score = rankSymbolMatch(symbol, q);
    if (score <= 0) continue;

    ranked.push({ symbol, score });
  }

  ranked.sort((a, b) => b.score - a.score);

  const results = ranked.slice(0, limit).map(entry => ({
    id: entry.symbol.id,
    name: entry.symbol.name,
    qualifiedName: entry.symbol.qualifiedName,
    summary: entry.symbol.summary,
    usage: entry.symbol.usage,
    source: entry.symbol.source,
  }));

  return {
    query,
    module: module || null,
    results,
  };
}

/**
 * Return the full symbol entry plus nearby alternatives.
 */
export async function getFaustSymbol(
  store: FaustDocStore,
  symbol: string
): Promise<any> {
  const [found, alternatives] = await store.findSymbol(symbol);

  if (found === null) {
    throw new Error(`Symbol not found: ${symbol}`);
  }

  return {
    symbol: found,
    alternatives: alternatives.map(alt => ({
      id: alt.id,
      qualifiedName: alt.qualifiedName,
      summary: alt.summary,
    })),
  };
}

/**
 * List lightweight symbol summaries from one module.
 */
export async function listFaustModule(
  store: FaustDocStore,
  module: string,
  limit: number = 200
): Promise<any> {
  const [library, symbols] = await store.getLibrarySymbols(module);

  if (library === null) {
    throw new Error(`Module not found: ${module}`);
  }

  return {
    module: normalizeModuleKey(module),
    file: library.file,
    aliasHints: library.aliasHints || [],
    symbols: symbols.slice(0, limit).map(symbol => ({
      id: symbol.id,
      qualifiedName: symbol.qualifiedName,
      summary: symbol.summary,
      usage: symbol.usage,
      source: symbol.source,
    })),
  };
}

/**
 * Return `testCode` snippets for a module or a symbol.
 */
export async function getFaustExamples(
  store: FaustDocStore,
  symbolOrModule: string,
  limit: number = 10
): Promise<any> {
  const key = (symbolOrModule || '').trim();
  if (!key) {
    throw new Error('Missing symbolOrModule');
  }

  // Try as module first
  const [library, symbols] = await store.getLibrarySymbols(key);
  if (library !== null) {
    const examples: any[] = [];
    for (const symbol of symbols) {
      if (!symbol.testCode) continue;

      examples.push({
        symbol: symbol.qualifiedName,
        code: symbol.testCode,
        source: symbol.source,
      });

      if (examples.length >= limit) break;
    }

    return {
      scope: 'module',
      query: key,
      file: library.file,
      examples,
    };
  }

  // Try as symbol
  const [found] = await store.findSymbol(key);
  if (found !== null) {
    const examples: any[] = [];
    if (found.testCode) {
      examples.push({
        symbol: found.qualifiedName,
        code: found.testCode,
        source: found.source,
      });
    }

    return {
      scope: 'symbol',
      query: key,
      examples,
    };
  }

  throw new Error(`No symbol/module found: ${key}`);
}

/**
 * Compose a short action-oriented explanation from one symbol entry.
 */
export async function explainFaustSymbolForGoal(
  store: FaustDocStore,
  symbol: string,
  goal: string
): Promise<any> {
  const [found] = await store.findSymbol(symbol);

  if (found === null) {
    throw new Error(`Symbol not found: ${symbol}`);
  }

  const goalText = (goal || '').trim();
  const params = found.params || [];
  const notes = found.notes || [];

  const paramHint = params.length > 0
    ? 'Key params: ' + params.map(p => `${p.name} (${p.description})`).join('; ')
    : 'No explicit parameter notes found.';

  const notesHint = notes.length > 0
    ? 'Notes: ' + notes.join(' ')
    : null;

  const usage = found.usage
    ? `Usage: ${found.usage}`
    : 'Usage not documented.';

  const parts = [
    `Use ${found.qualifiedName} when it matches this goal: ${goalText || 'general DSP design'}.`,
    found.summary || 'No summary found in comments.',
    usage,
    paramHint,
  ];

  if (notesHint) {
    parts.push(notesHint);
  }

  parts.push(
    found.testCode
      ? 'A test snippet is available via get_faust_examples.'
      : 'No test snippet found.'
  );

  const recommendation = parts.join(' ');

  return {
    symbol: found.qualifiedName,
    goal: goalText,
    recommendation,
  };
}
