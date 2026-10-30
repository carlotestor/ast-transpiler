/**
 * hx11 W9 `rust-bool-k-local-option-bool`: `let mut X: Value = self.safe_bool_k(obj, "k", &[..])`
 * (and `self.safe_bool(obj, key, &[..])`) whose every later use is a native-able bool read.
 *
 * Default `&[]` -> `Option<bool>` (`safe_bool_k_opt`); default `&[Value::Bool(b)]` -> `bool`
 * (`safe_bool_k_opt(..).unwrap_or(b)`). Accepted uses: `X.as_bool() ==/!= Some(b)`,
 * `X.is_truthy()`, `X ==/!= Value::Bool(b)`, `X ==/!= Value::Null` (Option only),
 * `X = Value::Bool(b)`, `is_true(&X)` (bool only) and `.insert("k".., X[.clone()])` sinks.
 * Any other use, a shadowing binding or a closure keeps `Value`.
 */
export declare function hx11w9RustBoolKLocalOptionBool(content: string): string;
