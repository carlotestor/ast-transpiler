// hx11 W9 `rust-dict-lit-key-read-iflet-closure-free`: literal-key dict read without the `|__m|` closure.
//   X.as_map().and_then(|__m| __m.get("k")).cloned().unwrap_or(Value::Null)
//     -> (if let Some(__m) = X.as_map() { __m.get("k").cloned().unwrap_or(Value::Null) } else { Value::Null })
// X is a side-effect-free place path. A rewrite that would push a line past 400 chars is skipped.

export function hx11w9RustDictLitKeyReadIfLetClosureFree(content: string): string {
    if (!content.includes('.as_map().and_then(|__m| __m.get("')) return content;
    const P = '[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*';
    const re = new RegExp(
        `(?<![A-Za-z0-9_.:])(${P})\\.as_map\\(\\)\\.and_then\\(\\|__m\\| __m\\.get\\(("(?:[^"\\\\\\n]|\\\\.)*")\\)\\)\\.cloned\\(\\)\\.unwrap_or\\(((?:crate::)?Value::Null)\\)`,
        'g');
    return content.replace(re, (m: string, x: string, k: string, nul: string, off: number, whole: string): string => {
        const text = `(if let Some(__m) = ${x}.as_map() { __m.get(${k}).cloned().unwrap_or(${nul}) } else { ${nul} })`;
        const ls = whole.lastIndexOf('\n', off) + 1;
        let le = whole.indexOf('\n', off); if (le < 0) le = whole.length;
        const oldLen = le - ls;
        return oldLen <= 400 && oldLen - m.length + text.length > 400 ? m : text;
    });
}
