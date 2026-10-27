/** `'map'` for a printed native-map parameter, undefined for any other shape. */
export declare function hx10w9Rp02ParamKind(printedParam: string): 'map' | undefined;
/** Dispatch argument for a native-map parameter (position `index` in `args`).
 *  The temp is built on the arm's own line: the whole expression on one line
 *  pushes a generated dispatch arm past the 400-char census limit. */
export declare function hx10w9Rp02DispatchArg(index: number): string;
/** Split a printed parameter list on top-level commas: a generic argument list
 *  (`IndexMap<String, Value>`) carries its own. */
export declare function hx10w9Rp02SplitArgs(argList: string): string[];
/** Names a file prints as `&mut IndexMap` parameters. Copying one is the only
 *  way to box it, so a dead-clone pass must not turn that copy into a move. */
export declare function hx10w9Rp02RefMapParamNames(content: string): Set<string>;
export declare function rp02SelfTest(): number;
