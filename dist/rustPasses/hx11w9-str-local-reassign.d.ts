/**
 * `let mut X: Value = self.safe_string*(obj, key, &[])` that is assigned again, where every
 * assignment is `X = self.safe_string*(..)` (same family, becomes its `_opt` twin),
 * `X = Value::Str("lit".into())` (becomes `Some("lit".to_string())`) or `X = Value::Null`
 * (becomes `None`), and every other use is a null test, an `as_str()` compare or a `Value`
 * operand (re-boxed with `Value::from`). Any other use keeps `Value`.
 */
export declare function hx11w9StrLocalReassign(content: string): string;
