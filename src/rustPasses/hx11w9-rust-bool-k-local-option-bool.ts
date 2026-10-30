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
export function hx11w9RustBoolKLocalOptionBool(content: string): string {
    const declRe = /^([ \t]*)let (mut )?([a-zA-Z_][a-zA-Z0-9_]*): Value = self\.(safe_bool_k|safe_bool)\(/gm;
    const strKeyRe = /^"(?:[^"\\]|\\.)*"$/;
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

    const masked = maskText(content);
    const grown = new Map<number, number>();
    const rewrites: Array<{ start: number, end: number, text: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(masked)) !== null) {
        const callee = m[4];
        const name = m[3];
        const callOpen = m.index + m[0].length - 1;
        const callClose = closeParen(masked, callOpen);
        if (callClose < 0) continue;
        const tail = /^\s*;/.exec(masked.slice(callClose, callClose + 3));
        if (tail === null) continue;
        const stmtEnd = callClose + tail[0].length;
        const base = callOpen + 1;
        const spans = argSpans(masked.slice(base, callClose - 1));
        if (spans.length !== 3) continue;
        const obj = content.slice(base + spans[0][0], base + spans[0][1]).trim();
        const keyRaw = content.slice(base + spans[1][0], base + spans[1][1]).trim();
        const defRaw = content.slice(base + spans[2][0], base + spans[2][1]).trim();
        if (obj.length === 0 || keyRaw.length === 0) continue;
        if (callee === 'safe_bool_k' && !strKeyRe.test(keyRaw)) continue;
        let dflt: boolean | null;
        const dm = /^&\[Value::Bool\((true|false)\)\]$/.exec(defRaw);
        if (defRaw === '&[]') dflt = null;
        else if (dm !== null) dflt = dm[1] === 'true';
        else continue;
        const isOpt = dflt === null;
        const end = braceEnd(masked, stmtEnd);
        const body = masked.slice(stmtEnd, end);
        if (new RegExp(`\\b(?:let|for|fn)\\s+(?:mut\\s+)?${name}\\b`).test(body)) continue;
        if (new RegExp(`\\|[^|\\n]*\\b${name}\\b[^|\\n]*\\|`).test(body)) continue;
        const useRe = new RegExp(`(?<![A-Za-z0-9_.:])${name}(?![A-Za-z0-9_])`, 'g');
        const edits: Array<{ start: number, end: number, text: string }> = [];
        const cmp = (eq: boolean, b: boolean): string => {
            // `X == Some(b)` / `X != Some(b)` on Option<bool>; plain or negated `X` on bool.
            if (isOpt) return `${name} ${eq ? '==' : '!='} Some(${b})`;
            return (eq === b) ? name : `!${name}`;
        };
        let ok = true; let u: RegExpExecArray | null;
        while ((u = useRe.exec(body)) !== null) {
            const at = u.index; const abs = stmtEnd + at; const after = body.slice(at + name.length);
            const before = body.slice(0, at);
            let g: RegExpExecArray | null;
            if ((g = /^\.as_bool\(\) (==|!=) Some\((true|false)\)/.exec(after)) !== null && !/[&*]\s*$/.test(before)) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: cmp(g[1] === '==', g[2] === 'true') });
            } else if ((g = /^\.is_truthy\(\)/.exec(after)) !== null && !/[&*]\s*$/.test(before)) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: isOpt ? `${name} == Some(true)` : name });
            } else if ((g = /^\s*(==|!=)\s*Value::Bool\((true|false)\)/.exec(after)) !== null && !/[&*]\s*$/.test(before)) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: cmp(g[1] === '==', g[2] === 'true') });
            } else if (isOpt && (g = /^\s*(==|!=)\s*Value::Null\b/.exec(after)) !== null && !/[&*]\s*$/.test(before)) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name}.${g[1] === '==' ? 'is_none' : 'is_some'}()` });
            } else if ((g = /^\s*=\s*Value::Bool\((true|false)\);/.exec(after)) !== null && /(?:^|[;{}\s])\s*$/.test(before)) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name} = ${isOpt ? `Some(${g[1]})` : g[1]};` });
            } else if (!isOpt && /is_true\(&$/.test(before) && /^\)/.test(after)) {
                continue; // `IsTruthy for &bool` is the identity
            } else if (/\.insert\(\s*"[^"]*"(?:\.to_string\(\)|\.into\(\))?,\s*$/.test(before.slice(-80).replace(/\n/g, ' '))
                && (g = /^(\.clone\(\))?\)/.exec(after)) !== null) {
                // `Value::Bool` / `Option<bool>` are `Copy`: the boxed value is rebuilt at the sink.
                edits.push({ start: abs, end: abs + name.length + g[0].length - 1, text: isOpt ? `${name}.map(Value::Bool).unwrap_or(Value::Null)` : `Value::Bool(${name})` });
            } else { ok = false; break; }
        }
        if (!ok || edits.length === 0) continue;
        const optName = callee === 'safe_bool_k' ? 'safe_bool_k_opt' : 'safe_bool_opt';
        const typeStart = m.index + m[1].length + 'let '.length + (m[2] ?? '').length + name.length;
        const declEdits = [
            { start: typeStart, end: callOpen, text: `: ${isOpt ? 'Option<bool>' : 'bool'} = self.${optName}` },
        ];
        if (!isOpt) declEdits.push({ start: callClose, end: callClose, text: `.unwrap_or(${dflt})` });
        const all = [...declEdits, ...edits];
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
        for (const e of all) rewrites.push(e);
    }
    if (rewrites.length === 0) return content;
    rewrites.sort((a, b) => a.start - b.start || a.end - b.end);
    let out = ''; let last = 0;
    for (const r of rewrites) {
        if (r.start < last) continue;
        out += content.slice(last, r.start) + r.text;
        last = r.end;
    }
    out += content.slice(last);
    return out;
}
