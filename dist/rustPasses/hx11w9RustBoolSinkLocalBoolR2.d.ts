/**
 * hx11 W9 `rust-bool-sink-local-bool-r2`: `let [mut] X: Value = self.safe_bool_k|safe_bool|safe_bool2|safe_bool_n(..)`
 * that the first-round bool passes skipped because a use follows `&&` (they reject any `&`-prefixed use).
 * Same twins and rewrites; `&&` is accepted, a single `&`/`*` prefix is not.
 */
export declare function hx11w9RustBoolSinkLocalBoolR2(content: string): string;
