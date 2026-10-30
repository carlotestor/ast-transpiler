/**
 * hx11 W9 `rust-bool2-local-option-bool`: `let mut X: Value = self.safe_bool2(obj, k1, k2, &[..])`
 * whose every later use is a native-able bool read. Default `&[]` -> `Option<bool>`
 * (`safe_bool2_opt`); default `&[Value::Bool(b)]` -> `bool` (`.unwrap_or(b)`). Same accepted uses
 * as the bool_k pass; a non-literal default, shadowing binding or closure keeps `Value`.
 */
export declare function hx11w9RustBool2LocalOptionBool(content: string): string;
