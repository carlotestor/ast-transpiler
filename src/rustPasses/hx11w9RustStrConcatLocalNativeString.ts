// hx11 W9 (rust): `let mut X: Value = Value::Str(format!(..).into());` concat locals become a native `String`.
// Pure text pass over the final Rust; every operand is a string literal or a `String` local.

/**
 * A `Value::Str(format!(..).into())` local whose operands are all string literals, nested concats
 * of them or `String` locals becomes a flat `String` `format!`. Uses are the literal pass's:
 * `format!` slots, `as_str()`, `stringify_param`, by-value operands re-boxed with `Value::from`.
 * Any write after the declaration or any other use keeps `Value`.
 */
export function hx11w9RustStrConcatLocalNativeString(content: string): string {
    const declRe = /^([ \t]*)let mut ([a-zA-Z_][a-zA-Z0-9_]*): Value = (Value::Str\(format!\(.*\)\.into\(\)\));[ \t]*$/gm;
    const litRe = /^Value::Str\(("(?:[^"\\\n]|\\.)*")\.(?:into|to_string)\(\)\)$/;
    // Blank string bodies and line comments; same length, quotes kept.
    const maskText = (src: string): string => {
        let out = ''; let i = 0;
        while (i < src.length) {
            const c = src[i];
            if (c === '/' && src[i + 1] === '/') {
                while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
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
    const closeParen = (src: string, open: number): number => {
        let depth = 0;
        for (let k = open; k < src.length; k++) {
            const c = src[k];
            if (c === '(') depth++;
            else if (c === ')') { depth--; if (depth === 0) return k + 1; }
        }
        return -1;
    };
    const braceEnd = (src: string, from: number): number => {
        let depth = 0;
        for (let k = from; k < src.length; k++) {
            const c = src[k];
            if (c === '{') depth++;
            else if (c === '}') { depth--; if (depth < 0) return k; }
        }
        return src.length;
    };
    const argSpans = (src: string): Array<[number, number]> => {
        const out: Array<[number, number]> = [];
        let depth = 0; let start = 0;
        for (let i = 0; i < src.length; i++) {
            const c = src[i];
            if (c === '(' || c === '[' || c === '{') depth++;
            else if (c === ')' || c === ']' || c === '}') depth--;
            else if (c === ',' && depth === 0) { out.push([start, i]); start = i + 1; }
        }
        out.push([start, src.length]);
        return out;
    };

    // The re-box consumes the `String`: only a last use outside any loop may move it.
    const boxUse = (name: string, kept: string, after: string, used: number, body: string): string => {
        const later = new RegExp(`(?<![A-Za-z0-9_.:])${name}(?![A-Za-z0-9_])`).test(after.slice(used));
        const inLoop = /\b(?:loop|while|for)\b/.test(body);
        const arg = kept === '' && (later || inLoop) ? `${name}.clone()` : `${name}${kept}`;
        return `Value::from(${arg})`;
    };

    const masked = maskText(content);
    type Part = { lit?: string, id?: string };
    // Flatten `Value::Str(format!("{}{}", a, b).into())`; only literals and `String` locals qualify.
    const concatParts = (text: string, at: number): Part[] | undefined => {
        const lit = litRe.exec(text);
        if (lit !== null) return [{ lit: lit[1] }];
        const f = /^Value::Str\(format!\(("(?:\{\})+"),\s*([\s\S]*)\)\.into\(\)\)$/.exec(text);
        if (f === null) return undefined;
        const spans = argSpans(maskText(f[2]));
        if (spans.length !== (f[1].length - 2) / 2) return undefined;
        const out: Part[] = [];
        for (const [x, y] of spans) {
            const arg = f[2].slice(x, y).trim();
            if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(arg)) {
                if (!isStringLocal(arg, at)) return undefined;
                out.push({ id: arg });
                continue;
            }
            const sub = concatParts(arg, at);
            if (sub === undefined) return undefined;
            out.push(...sub);
        }
        return out;
    };
    // `let [mut] id: String` is the nearest binding of `id` in the same fn and its block is still open.
    const isStringLocal = (id: string, at: number): boolean => {
        const fnAt = masked.lastIndexOf('fn ', at);
        if (fnAt < 0) return false;
        const sig = masked.slice(fnAt, masked.indexOf('{', fnAt));
        if (new RegExp(`[(,]\\s*(?:mut\\s+)?${id}\\s*:`).test(sig)) return false;
        const seg = masked.slice(fnAt, at);
        const binds = [...seg.matchAll(new RegExp(`\\b(?:let|for)\\s+(?:mut\\s+)?${id}\\b([^=;\\n]*)`, 'g'))];
        const last = binds[binds.length - 1];
        if (last === undefined || !/^\s*:\s*String\s*$/.test(last[1])) return false;
        let depth = 0;
        for (const ch of seg.slice(last.index!)) {
            if (ch === '{') depth++;
            else if (ch === '}' && --depth < 0) return false;
        }
        return true;
    };

    type Edit = { start: number, end: number, text: string };
    const groups: Edit[][] = [];
    const grown = new Map<number, number>();
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(masked)) !== null) {
        const name = m[2];
        const stmtEnd = m.index + m[0].length;
        const parts = concatParts(content.slice(m.index, stmtEnd).replace(/^[^=]*=\s*/, '').replace(/;\s*$/, ''), m.index);
        if (parts === undefined) continue;
        const end = braceEnd(masked, stmtEnd);
        const body = masked.slice(stmtEnd, end);
        if (new RegExp(`\\b(?:let|for|fn)\\s+(?:mut\\s+)?${name}\\b`).test(body)) continue;
        if (new RegExp(`\\|[^|\\n]*\\b${name}\\b[^|\\n]*\\|`).test(body)) continue;
        const fRe = /format!\(/g;
        const fSpans: Array<[number, number, boolean]> = [];
        let f: RegExpExecArray | null;
        while ((f = fRe.exec(body)) !== null) {
            const close = closeParen(body, f.index + f[0].length - 1);
            if (close < 0) continue;
            const fl = /^"(?:[^"\\]|\\.)*"/.exec(body.slice(f.index + f[0].length, close));
            fSpans.push([f.index, close, fl !== null && /:\?/.test(fl[0])]);
        }
        const useRe = new RegExp(`(?<![A-Za-z0-9_.:])${name}(?![A-Za-z0-9_])`, 'g');
        const edits: Edit[] = [];
        let ok = true; let u: RegExpExecArray | null;
        while ((u = useRe.exec(body)) !== null) {
            const at = u.index; const abs = stmtEnd + at;
            const after = body.slice(at + name.length);
            const before = body.slice(0, at);
            let g: RegExpExecArray | null;
            // 1. A write: the local stays `Value`.
            if (/^\s*=(?!=)/.test(after) && !/[!<>=&|]\s*$/.test(before)) { ok = false; break; }
            // 2. A whole `format!` slot (not a `{:?}` sink): `String` prints the same text.
            const cand = fSpans.filter(([s, e]) => at > s && at < e);
            if (cand.length > 0) {
                const hit = cand.reduce((a, b) => (b[0] > a[0] ? b : a));
                const inner = hit[0] + 'format!('.length;
                const slot = argSpans(body.slice(inner, hit[1] - 1))
                    .filter(([a, b]) => inner + a <= at && at + name.length <= inner + b);
                if (slot.length > 0 && body.slice(inner + slot[0][0], inner + slot[0][1]).replace(/\s+/g, '') === name) {
                    if (hit[2]) { ok = false; break; }
                    continue;
                }
            }
            if ((g = /^\.as_str\(\)/.exec(after)) !== null && !/&\s*$/.test(before)) {
                // `Option<&str>` as the boxed accessor gave.
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `Some(${name}.as_str())` });
            } else if (/crate::runtime::stringify_param\(&$/.test(before) && /^\)/.test(after)) {
                // The helper prints a `Str` as its text.
                const from = abs - 'crate::runtime::stringify_param(&'.length;
                edits.push({ start: from, end: abs + name.length + 1, text: `${name}.clone()` });
            } else if (/(?:[(,\[]\s*)$/.test(before) && !/&\s*$/.test(before)
                && (g = /^(\.clone\(\))?(?=\s*[,)\];])/.exec(after)) !== null) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: boxUse(name, g[0], after, g[0].length, body) });
            } else if (/(?<![=!<>])=\s$/.test(before) && (g = /^(\.clone\(\))?(?=\s*[;,)])/.exec(after)) !== null) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: boxUse(name, g[0], after, g[0].length, body) });
            } else { ok = false; break; }
        }
        if (!ok) continue;
        // Every edit keeps its line at most 400 chars unless it was already longer.
        const declText = `${m[1]}let mut ${name}: String = format!("${parts.map((q) => (q.lit !== undefined ? q.lit.slice(1, -1).replace(/[{}]/g, (c) => c + c) : '{}')).join('')}"${parts.filter((q) => q.lit === undefined).map((q) => ', ' + q.id).join('')});`;
        const all: Edit[] = [{ start: m.index, end: stmtEnd, text: declText }, ...edits];
        const lineGrow = new Map<number, number>();
        for (const e of all) {
            const ls = content.lastIndexOf('\n', e.start) + 1;
            lineGrow.set(ls, (lineGrow.get(ls) ?? 0) + e.text.length - (e.end - e.start));
        }
        let longer = false;
        for (const [ls, grow] of lineGrow) {
            let le = content.indexOf('\n', ls); if (le < 0) le = content.length;
            const cur = le - ls + (grown.get(ls) ?? 0);
            if (cur <= 400 && cur + grow > 400) longer = true;
        }
        if (longer) continue;
        for (const [ls, grow] of lineGrow) grown.set(ls, (grown.get(ls) ?? 0) + grow);
        groups.push(all);
    }
    const rewrites = groups.flat();
    if (rewrites.length === 0) return content;
    rewrites.sort((a, b) => a.start - b.start);
    let out = ''; let last = 0;
    for (const r of rewrites) {
        if (r.start < last) continue; // overlapping: keep the first
        out += content.slice(last, r.start) + r.text;
        last = r.end;
    }
    out += content.slice(last);
    return out;
}
