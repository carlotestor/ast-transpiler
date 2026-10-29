// hx11 W4 P1 / W7 (rust): `safe_string*` locals narrowed to a native `String` / `Option<String>`.
// Text passes over the final Rust; neither touches `this`.

/**
 * `let X: Value = self.safe_string*(obj, key, &[default])` whose every later use is its own
 * slot of a `format!` becomes a native `String` through the family's `_opt` twin, which has
 * the same lookup and default rules. Any other use, a `{:?}` sink or a non-`Str` default
 * keeps `Value`.
 */
export function narrowStrSinkLocals(content: string): string {
    // Boxed family -> its `Option<String>` twin on the same `Exchange` impl.
    const OPT: { [k: string]: string } = {
        safe_string: 'safe_string_opt',
        safe_string_k: 'safe_string_k_opt',
        safe_string_lower_k: 'safe_string_lower_k_opt',
        safe_string_upper_k: 'safe_string_upper_k_opt',
    };
    const declRe = /^([ \t]*)let (mut )?([a-zA-Z_][a-zA-Z0-9_]*): Value = self\.(safe_string[a-z_0-9]*)\(/gm;
    const strKeyRe = /^"(?:[^"\\]|\\.)*"$/;
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

    const masked = maskText(content);
    const rewrites: Array<{ start: number, end: number, text: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(masked)) !== null) {
        const fam = m[4];
        const opt = OPT[fam];
        if (opt === undefined) continue;
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
        // The `_k` twins take `&str`, the `safe_string` twin a `Value` key: both pass verbatim.
        if (fam.endsWith('_k') && !strKeyRe.test(keyRaw)) continue;
        // A non-`Str` default would print its `Value`, not the `String` accessor's text.
        if (defRaw !== '&[]' && !/^&\[\s*Value::Str\(/.test(defRaw)) continue;
        const end = braceEnd(masked, stmtEnd);
        const body = masked.slice(stmtEnd, end);
        // A second binding of the name makes the use scan ambiguous.
        if (new RegExp(`\\b(?:let|for|fn)\\s+(?:mut\\s+)?${name}\\b`).test(body)) continue;
        if (new RegExp(`\\|[^|\\n]*\\b${name}\\b[^|\\n]*\\|`).test(body)) continue;
        const fRe = /format!\(/g;
        const fSpans: Array<[number, number, boolean]> = [];
        let f: RegExpExecArray | null;
        while ((f = fRe.exec(body)) !== null) {
            const close = closeParen(body, f.index + f[0].length - 1);
            if (close < 0) continue;
            const lit = /^"(?:[^"\\]|\\.)*"/.exec(body.slice(f.index + f[0].length, close));
            fSpans.push([f.index, close, lit !== null && /:\?/.test(lit[0])]);
        }
        const useRe = new RegExp(`(?<![A-Za-z0-9_.])${name}(?![A-Za-z0-9_])`, 'g');
        let ok = true; let uses = 0;
        let u: RegExpExecArray | null;
        while ((u = useRe.exec(body)) !== null) {
            const at = u.index;
            const cand = fSpans.filter(([s, e]) => at > s && at < e);
            if (cand.length === 0) { ok = false; break; }
            const hit = cand.reduce((a, b) => (b[0] > a[0] ? b : a));
            if (hit[2]) { ok = false; break; }
            // The use must BE a `format!` argument slot, not a block inside one.
            const inner = hit[0] + 'format!('.length;
            const slot = argSpans(body.slice(inner, hit[1] - 1))
                .filter(([a, b]) => inner + a <= at && at + name.length <= inner + b);
            if (slot.length === 0) { ok = false; break; }
            if (body.slice(inner + slot[0][0], inner + slot[0][1]).replace(/\s+/g, '') !== name) { ok = false; break; }
            uses++;
        }
        if (!ok || uses === 0) continue;
        const indent = m[1];
        const text = `${indent}let ${name}: String = self.${opt}(${obj}, ${keyRaw}, ${defRaw}).unwrap_or_default();`;
        if (indent.length + text.length > 400 && stmtEnd - m.index <= 400) continue;
        rewrites.push({ start: m.index, end: stmtEnd, text });
    }
    if (rewrites.length === 0) return content;
    rewrites.sort((a, b) => a.start - b.start);
    let out = ''; let last = 0;
    for (const r of rewrites) {
        if (r.start < last) continue; // overlapping — should not happen; keep the first
        out += content.slice(last, r.start) + r.text;
        last = r.end;
    }
    out += content.slice(last);
    return out;
}

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
export function narrowStrNullLocals(content: string): string {
    const OPT: { [k: string]: string } = {
        safe_string: 'safe_string_opt',
        safe_string_k: 'safe_string_k_opt',
        safe_string_lower_k: 'safe_string_lower_k_opt',
        safe_string_upper_k: 'safe_string_upper_k_opt',
    };
    const declRe = /^([ \t]*)let (mut )?([a-zA-Z_][a-zA-Z0-9_]*): Value = self\.(safe_string[a-z_0-9]*)\(/gm;
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
    const groups: Array<{ decl: { start: number, end: number, text: string }, edits: Array<{ start: number, end: number, text: string }> }> = [];
    const rewrites: Array<{ start: number, end: number, text: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(masked)) !== null) {
        const opt = OPT[m[4]];
        if (opt === undefined) continue;
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
        if (m[4].endsWith('_k') && !strKeyRe.test(keyRaw)) continue;
        // Only a `Null` default maps to `None`.
        if (defRaw !== '&[]') continue;
        const end = braceEnd(masked, stmtEnd);
        const body = masked.slice(stmtEnd, end);
        if (new RegExp(`\\b(?:let|for|fn)\\s+(?:mut\\s+)?${name}\\b`).test(body)) continue;
        if (new RegExp(`\\|[^|\\n]*\\b${name}\\b[^|\\n]*\\|`).test(body)) continue;
        const useRe = new RegExp(`(?<![A-Za-z0-9_.:])${name}(?![A-Za-z0-9_])`, 'g');
        const edits: Array<{ start: number, end: number, text: string }> = [];
        let ok = true; let u: RegExpExecArray | null;
        while ((u = useRe.exec(body)) !== null) {
            const at = u.index; const abs = stmtEnd + at; const after = body.slice(at + name.length);
            const before = body.slice(0, at);
            let g: RegExpExecArray | null;
            if ((g = /^\s*(==|!=)\s*Value::Null\b/.exec(after)) !== null && !/[&*]\s*$/.test(before)) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name}.${g[1] === '==' ? 'is_none' : 'is_some'}()` });
            } else if ((g = /^\.as_str\(\)/.exec(after)) !== null) {
                // `Option<String>::as_deref()` is the same `Option<&str>` the boxed `as_str()` gave.
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name}.as_deref()` });
            } else if (/get_value\(&$/.test(before)
                && (g = /^, &Value::Int\(0\)\)\.as_str\(\) (==|!=) Some\("/.exec(after)) !== null) {
                // First character probe; the char sits in the unmasked text at the same offsets.
                const chPos = abs + name.length + g[0].length;
                const ch = /^([^"\\])"\)/.exec(content.slice(chPos, chPos + 3));
                if (ch === null) { ok = false; break; }
                const probe = `${name}.as_deref().unwrap_or("").starts_with("${ch[1]}")`;
                edits.push({ start: abs - 'get_value(&'.length, end: chPos + ch[0].length, text: g[1] === '==' ? probe : `!${probe}` });
            } else if (/crate::runtime::stringify_param\(&$/.test(before) && /^\)/.test(after)) {
                // The helper prints `null` for `Null` and the text for `Str`: both are `Option<String>` states.
                const from = abs - 'crate::runtime::stringify_param(&'.length;
                edits.push({ start: from, end: abs + name.length + 1, text: `${name}.as_deref().unwrap_or("null").to_string()` });
            } else if (/(?:[(,\[]\s*&?|(?<![=!<>])=\s)$/.test(before) && !/&\s*mut\s*$/.test(before)
                && (g = /^(\.clone\(\))?(?=\s*[,)\];])/.exec(after)) !== null && !/==\s*$/.test(before)) {
                // The conversion consumes the `Option`: only the last use, outside any loop, may move it.
                const lastUse = !new RegExp(`(?<![A-Za-z0-9_.:])${name}(?![A-Za-z0-9_])`).test(after.slice(g[0].length));
                const inLoop = /\b(?:loop|while|for)\b/.test(body);
                const move = lastUse && !inLoop && !/&\s*$/.test(before);
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name}${move ? '' : '.clone()'}.map(Value::from).unwrap_or(Value::Null)` });
            } else { ok = false; break; }
        }
        if (!ok || edits.length === 0) continue;
        // A longer line must not newly cross 400 chars, counting growth from earlier locals.
        const declText = `${m[1]}let ${m[2] ?? ''}${name}: Option<String> = self.${opt}(${obj}, ${keyRaw}, ${defRaw});`;
        const all = [{ start: m.index, end: stmtEnd, text: declText }, ...edits];
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
        groups.push({ decl: { start: m.index, end: stmtEnd, text: declText }, edits });
    }
    // A use that sits inside another narrowed local's initializer would be lost when that
    // statement is reprinted from its original text: leave the used local boxed.
    for (let again = true; again;) {
        again = false;
        for (let a = 0; a < groups.length; a++) {
            const hit = groups.some((b, bi) => bi !== a
                && groups[a].edits.some(e => e.start >= b.decl.start && e.start < b.decl.end));
            if (hit) { groups.splice(a, 1); again = true; break; }
        }
    }
    for (const gr of groups) { rewrites.push(gr.decl); for (const e of gr.edits) rewrites.push(e); }
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
