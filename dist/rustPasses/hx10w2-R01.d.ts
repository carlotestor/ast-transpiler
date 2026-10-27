export type Hx10R01Stats = {
    seqLocals: number;
    seqReads: number;
    dictLocals: number;
    dictReads: number;
};
/**
 * Native `get_value` on statically pinned receivers. `stats` is filled in for
 * the campaign census.
 */
export declare function nativeGetValue(content: string, stats?: Hx10R01Stats): string;
export declare function r01W2SelfTest(): number;
