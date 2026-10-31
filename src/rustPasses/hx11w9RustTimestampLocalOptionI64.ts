// hx11 W9 (rust): `safe_timestamp_k` / `safe_timestamp2` / `safe_timestamp_n` locals become `Option<i64>`.
// Pure text pass over the final Rust; relies on `From<Option<i64>> for Value` and the `*_opt` stubs twins.

/**
 * `let [mut] X: Value = self.safe_timestamp_k|safe_timestamp2|safe_timestamp_n(.., &[] | &[Value::Null])`
 * becomes `Option<i64>` (`safe_timestamp_k_opt` / `safe_timestamp2_opt` / `safe_timestamp_n_opt`) when every
 * later use of `X` is one of:
 *   `X.clone()` -> `Value::from(X)`           `self.iso8601(X)` / `m.insert("k".to_string(), X);` sinks
 *   `X != / == Value::Null` -> `is_some()` / `is_none()`
 *   `X.as_f64() == / != Some(<n>[.0])` -> `X == / != Some(<n>)`
 *   `X = Value::Null | Value::Int(n) | self.safe_timestamp*(..);` -> `None` / `Some(n)` / `.as_i64()`
 * Any other use, or a second binding of the name, keeps `Value`.
 */
export function hx11w9RustTimestampLocalOptionI64(content: string): string {
    const declRe = /^([ \t]*)let (mut )?([a-zA-Z_][a-zA-Z0-9_]*): Value = self\.safe_timestamp(_k|2|_n)\(/gm;
    const closeOf = (src: string, open: number): number => {
        let depth = 0; let inStr = false; let esc = false; let inLine = false;
        for (let k = open; k < src.length; k++) {
            const c = src[k];
            if (inLine) { if (c === '\n') inLine = false; continue; }
            if (inStr) {
                if (esc) esc = false;
                else if (c === '\\') esc = true;
                else if (c === '"') inStr = false;
                continue;
            }
            if (c === '"') { inStr = true; continue; }
            if (c === '/' && src[k + 1] === '/') { inLine = true; continue; }
            if (c === '(') depth++;
            else if (c === ')') { depth--; if (depth === 0) return k + 1; }
        }
        return -1;
    };
    // Same length; string bodies, line and block comments blanked (quotes kept).
    const mask = (src: string): string => {
        let out = ''; let i = 0;
        const blank = (s: string) => s.replace(/[^\n]/g, ' ');
        while (i < src.length) {
            const c = src[i];
            if (c === '/' && src[i + 1] === '/') {
                while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
                continue;
            }
            if (c === '/' && src[i + 1] === '*') {
                const e = src.indexOf('*/', i + 2);
                const stop = e < 0 ? src.length : e + 2;
                out += blank(src.slice(i, stop)); i = stop;
                continue;
            }
            if (c === '"') {
                out += '"'; i++;
                while (i < src.length && src[i] !== '"') {
                    if (src[i] === '\\') { out += '  '; i += 2; continue; }
                    out += src[i] === '\n' ? '\n' : ' ';
                    i++;
                }
                if (i < src.length) { out += '"'; i++; }
                continue;
            }
            out += c; i++;
        }
        return out;
    };
    // End of the block holding the declaration (first unmatched `}`).
    const scopeEnd = (masked: string, from: number): number => {
        let depth = 0;
        for (let k = from; k < masked.length; k++) {
            if (masked[k] === '{') depth++;
            else if (masked[k] === '}') { depth--; if (depth < 0) return k; }
        }
        return masked.length;
    };
    const splitArgs = (src: string): string[] => {
        const out: string[] = []; let cur = ''; let depth = 0; let inStr = false; let esc = false;
        for (const c of src) {
            if (inStr) {
                cur += c;
                if (esc) esc = false;
                else if (c === '\\') esc = true;
                else if (c === '"') inStr = false;
                continue;
            }
            if (c === '"') { inStr = true; cur += c; continue; }
            if (c === '(' || c === '[' || c === '{') depth++;
            else if (c === ')' || c === ']' || c === '}') depth--;
            if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
            cur += c;
        }
        out.push(cur);
        return out;
    };

    const maskedAll = mask(content);
    type Rw = { start: number, end: number, text: string };
    const rewrites: Rw[] = [];
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(content)) !== null) {
        const name = m[3];
        const kind = m[4];
        const callOpen = m.index + m[0].length - 1;
        const callClose = closeOf(content, callOpen);
        if (callClose < 0) continue;
        const tail = /^\s*;/.exec(content.slice(callClose, callClose + 3));
        if (tail === null) continue;
        const stmtEnd = callClose + tail[0].length;
        const args = splitArgs(content.slice(callOpen + 1, callClose - 1));
        if (args.length !== (kind === '2' ? 4 : 3)) continue;
        if (!/^&\[\s*(?:Value::Null)?\s*\]$/.test(args[args.length - 1].trim())) continue;
        const end = scopeEnd(maskedAll, stmtEnd);
        const masked = maskedAll.slice(stmtEnd, end);
        if (new RegExp(`\\b(?:let|for|fn)\\s+(?:mut\\s+)?${name}\\b`).test(masked)) continue;
        if (new RegExp(`\\blet\\b[^=;\\n]*\\b${name}\\b`).test(masked)) continue;
        if (new RegExp(`\\|[^|\\n]*\\b${name}\\b[^|\\n]*\\|`).test(masked)) continue;
        const useRe = new RegExp(`(?<![A-Za-z0-9_.])${name}(?![A-Za-z0-9_])`, 'g');
        const uses: Rw[] = [];
        let ok = true; let u: RegExpExecArray | null;
        while ((u = useRe.exec(masked)) !== null) {
            const s = u.index; const e = s + name.length;
            const after = masked.slice(e);
            const before = masked.slice(0, s);
            const abs = (x: number) => stmtEnd + x;
            let g: RegExpExecArray | null;
            if (after.startsWith('.clone()')) {
                uses.push({ start: abs(s), end: abs(e + 8), text: `Value::from(${name})` });
                useRe.lastIndex = e + 8;
            } else if ((g = /^\s*(!=|==)\s*Value::Null\b/.exec(after)) !== null) {
                uses.push({ start: abs(s), end: abs(e + g[0].length), text: `${name}.${g[1] === '!=' ? 'is_some' : 'is_none'}()` });
                useRe.lastIndex = e + g[0].length;
            } else if ((g = /^\.as_f64\(\)\s*(==|!=)\s*Some\((-?\d+)(?:\.0)?\)/.exec(after)) !== null) {
                uses.push({ start: abs(s), end: abs(e + g[0].length), text: `${name} ${g[1]} Some(${g[2]})` });
                useRe.lastIndex = e + g[0].length;
            } else if (/self\.iso8601\($/.test(before) && after.startsWith(')')) {
                uses.push({ start: abs(s), end: abs(e), text: `Value::from(${name})` });
            } else if (/\bm\.insert\("[^"\n]*"\.to_string\(\),\s*$/.test(before) && after.startsWith(');')) {
                uses.push({ start: abs(s), end: abs(e), text: `Value::from(${name})` });
            } else if (/(?:^|[;{}])\s*$/.test(before) && (g = /^\s*=(?!=)\s*/.exec(after)) !== null) {
                const rhsAt = stmtEnd + e + g[0].length;
                const rhs = /^(Value::Null|Value::Int\((-?\d+)\))\s*;/.exec(content.slice(rhsAt, rhsAt + 40));
                if (rhs !== null) {
                    uses.push({ start: rhsAt, end: rhsAt + rhs[1].length, text: rhs[2] === undefined ? 'None' : `Some(${rhs[2]})` });
                } else {
                    const call = /^self\.safe_timestamp(?:_k|2|_n)?\(/.exec(content.slice(rhsAt, rhsAt + 30));
                    if (call === null) { ok = false; break; }
                    const o = rhsAt + call[0].length - 1;
                    const c = closeOf(content, o);
                    if (c < 0 || !/^\s*;/.test(content.slice(c, c + 3))) { ok = false; break; }
                    const a = splitArgs(content.slice(o + 1, c - 1));
                    const want = call[0].endsWith('2(') ? 4 : 3;
                    if (a.length !== want || !/^&\[\s*(?:Value::Null|Value::Int\(-?\d+\))?\s*\]$/.test(a[a.length - 1].trim())) { ok = false; break; }
                    uses.push({ start: c, end: c, text: '.as_i64()' });
                }
                useRe.lastIndex = e;
            } else {
                ok = false; break;
            }
        }
        if (!ok) continue;
        rewrites.push({ start: m.index, end: callOpen, text: content.slice(m.index, callOpen).replace(': Value =', ': Option<i64> =') + '_opt' });
        for (const use of uses) rewrites.push(use);
    }
    if (rewrites.length === 0) return content;
    rewrites.sort((a, b) => a.start - b.start || a.end - b.end);
    let out = ''; let last = 0;
    for (const r of rewrites) {
        if (r.start < last) continue;
        out += content.slice(last, r.start) + r.text;
        last = r.end;
    }
    return out + content.slice(last);
}
