// Locates the hand-written Java runtime (java/lib/src/main/java/io/github/ccxt) that the Java text
// post-passes read as their type table. The ccxt build/ originals derived it from import.meta.url;
// as a library the root is resolved lazily from an explicit override, CCXT_JAVA_RUNTIME_ROOT, or the cwd.
import fs from 'fs';
import path from 'path';

const RUNTIME_SEGMENTS = [ 'java', 'lib', 'src', 'main', 'java', 'io', 'github', 'ccxt' ];

let override: string | undefined;
let resolvedKey: string | undefined;
let resolvedRoot: string | undefined;
let lastRoot: string | undefined;
const resets: (() => void)[] = [];

// passes register a closure that drops their per-root caches; it runs when the resolved root changes
export function onJavaRuntimeRootChange (reset: () => void): void {
    resets.push (reset);
}

export function setJavaRuntimeRoot (p: string | undefined): void {
    override = p;
}

function resolveRoot (cwd: string): string {
    if (override !== undefined && override !== '') return override;
    const env = process.env.CCXT_JAVA_RUNTIME_ROOT;
    if (env !== undefined && env !== '') return env;
    const direct = path.join (cwd, ...RUNTIME_SEGMENTS);
    if (fs.existsSync (direct)) return direct;
    let dir = cwd;
    for (;;) {
        const candidate = path.join (dir, ...RUNTIME_SEGMENTS);
        if (fs.existsSync (candidate)) return candidate;
        const parent = path.dirname (dir);
        if (parent === dir) break;
        dir = parent;
    }
    return direct;
}

export function javaRuntimeRoot (): string {
    const cwd = process.cwd ();
    const key = [ override ?? '', process.env.CCXT_JAVA_RUNTIME_ROOT ?? '', cwd ].join ('\u0000');
    if (key !== resolvedKey || resolvedRoot === undefined) {
        resolvedKey = key;
        resolvedRoot = resolveRoot (cwd);
    }
    if (lastRoot !== undefined && lastRoot !== resolvedRoot) {
        for (const reset of resets) reset ();
    }
    lastRoot = resolvedRoot;
    return resolvedRoot;
}
