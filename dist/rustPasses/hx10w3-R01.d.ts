type Shape = 'String' | 'Int' | 'Float' | 'Bool' | 'Vec' | 'Map';
export type R01Reject = {
    shape: Shape;
    name: string;
    line: number;
    text: string;
};
/** Blocking uses from the last run (diagnostics only). */
export declare let r01Rejects: R01Reject[];
/** Type the `Value` locals whose initializer pins the variant and whose every use is native. */
export declare function r01TypedLocals(content: string): string;
/** One case per rule; each one fails on the base generator (no such pass). */
export declare function r01SelfTest(): string[];
export {};
