/**
 * hx10 wave-2 R02 — native `insert` for `add_element_to_object` /
 * `get_value_mut` write chains on a receiver whose static shape is proven
 * tag-free in the emitted Rust text.
 *
 * `add_element_to_object` and `get_value_mut` only do extra work on a dict
 * carrying one of the runtime's `__` tags (`__book_id`, `__ws_subs_url`,
 * `__sub_ref`, `__cache_backref`); on any other receiver they are exactly
 * `Arc::make_mut(m).insert(key, val)` and `entry(key).or_insert(Value::Null)`.
 * So a receiver that provably never carries a tag (a hand-written base field
 * the runtime never tags, or a local whose every binding is a fresh literal
 * and whose function contains no `"__` literal) prints natively.
 */
/**
 * Rewrite `x[k] = v` / nested `x[a][b] = v` writes on a proven tag-free
 * receiver into the native `insert` the helper performs on one.
 */
export declare function r02NativeInserts(content: string): string;
