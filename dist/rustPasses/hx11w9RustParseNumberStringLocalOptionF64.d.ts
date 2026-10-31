/**
 * Arg proofs: `Value::Str(..)` literal, `Precise::string*(..)` (Str/Null), `self.safe_string[_k](.., &[])` (Str/Null),
 * `A[.clone()].map(Value::from).unwrap_or(Value::Null)` with `A: Option<String>` in the same fn.
 * Uses: `X != / == Value::Null`, `X.clone()` (-> `Value::from(X)`), bare `X` as last arg of `m.insert("k".to_string(), X);`.
 */
export declare function hx11w9RustParseNumberStringLocalOptionF64(content: string): string;
