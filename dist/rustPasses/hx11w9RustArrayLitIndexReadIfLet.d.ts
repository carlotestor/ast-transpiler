/**
 * `X.as_array().and_then(|__arr| __arr.get(N)).cloned().unwrap_or(Value::Null)` with N an integer literal
 * and X a side-effect-free place path becomes
 * `(if let Some(__arr) = X.as_array() { __arr.get(N).cloned().unwrap_or(Value::Null) } else { Value::Null })`.
 * A non-array X and an out-of-range N stay Null as before. A rewrite that would push a line over 400 chars is skipped.
 */
export declare function hx11w9RustArrayLitIndexReadIfLet(content: string): string;
