/**
 * A `Value::Str(format!(..).into())` local whose operands are all string literals, nested concats
 * of them or `String` locals becomes a flat `String` `format!`. Uses are the literal pass's:
 * `format!` slots, `as_str()`, `stringify_param`, by-value operands re-boxed with `Value::from`.
 * Any write after the declaration or any other use keeps `Value`.
 */
export declare function hx11w9RustStrConcatLocalNativeString(content: string): string;
