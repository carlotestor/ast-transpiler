interface FieldSets {
    tier1: Set<string>;
    tier2: Set<string>;
}
interface FieldOptions {
    sets?: FieldSets;
}
export declare function j01w7FieldPuts(content: string, options?: FieldOptions): string;
export declare function j01w7FieldPutsSelfTest(): string[];
export {};
