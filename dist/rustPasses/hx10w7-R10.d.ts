/** Blank out comments and string bodies, keeping every index in place. */
export declare function r10Mask(src: string): string;
/** `[start, end)` of every top-level `pub fn` body plus its header text. */
export declare function r10FnBodies(masked: string): Array<{
    fnStart: number;
    open: number;
    close: number;
    header: string;
}>;
export declare function r10ClientHandleMasked(content: string): string;
/**
 * Same rewrite, driven by line structure instead of a masked character walk.
 * A method starts on a `pub fn …(` line that sits directly inside an `impl`
 * block, and ends where the brace depth returns to that level; brace counting
 * skips comment and string spans per line.
 */
export declare function r10ClientHandle(content: string): string;
export declare function r10SelfTest(): string[];
