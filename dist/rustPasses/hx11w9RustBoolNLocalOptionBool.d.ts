/**
 * hx11 W9 `rust-bool-n-local-option-bool`: `let mut X: Value = self.safe_bool_n(obj, Value::from(vec![Value::Str(..), ..]), &[..])`
 * whose every later use is a native-able bool read.
 *
 * Default `&[]` -> `Option<bool>` (`safe_bool_n_opt`); default `&[Value::Bool(b)]` -> `bool`
 * (`safe_bool_n_opt(..).unwrap_or(b)`). Accepted uses: `X.as_bool() ==/!= Some(b)`,
 * `X.is_truthy()`, `X ==/!= Value::Bool(b)`, `X ==/!= Value::Null` (Option only),
 * `X = Value::Bool(b)`, `is_true(&X)` (bool only) and `.insert("k".., X[.clone()])` sinks.
 * Any other use, a shadowing binding or a closure keeps `Value`.
 */
export declare function hx11w9RustBoolNLocalOptionBool(content: string): string;
