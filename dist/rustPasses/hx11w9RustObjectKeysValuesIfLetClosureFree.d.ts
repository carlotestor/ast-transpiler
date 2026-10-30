/**
 * `Value::Array(X.as_map().map(|__m| BODY).unwrap_or_default())` with BODY the keys or values
 * collect becomes `Value::Array(if let Some(__m) = X.as_map() { BODY } else { Vec::new() })`.
 * X must be a side-effect-free place path not preceded by `[\w.:]`; a rewrite that would push a
 * line over 400 chars is skipped.
 */
export declare function hx11w9RustObjectKeysValuesIfLetClosureFree(content: string): string;
