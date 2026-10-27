/**
 * `let X: Value = self.safe_string*(obj, key, &[default])` whose every later use is its own
 * slot of a `format!` becomes a native `String` through the family's `_opt` twin, which has
 * the same lookup and default rules. Any other use, a `{:?}` sink or a non-`Str` default
 * keeps `Value`.
 */
export declare function narrowStrSinkLocals(content: string): string;
/**
 * `let X: Value = self.safe_string*(obj, key, &[])` whose uses are all null tests,
 * `as_str()` compares, `stringify_param` calls or plain `Value` operands becomes
 * `Option<String>` through the `_opt` twin (same lookup and default rules, `None` where
 * the boxed helper yields `Null`). Null tests print `is_none()`/`is_some()`, compares
 * `as_deref()`, `get_value(&X, &Value::Int(0)).as_str() == Some("c")` the `starts_with("c")`
 * of the same first character, `stringify_param(&X)` the text it prints, and a `Value`
 * operand re-boxes through
 * `Value::from`, which builds the `Value::Str` the helper returned. Any other use, a
 * `&mut`, an assignment or a closure keeps `Value`.
 */
export declare function narrowStrNullLocals(content: string): string;
