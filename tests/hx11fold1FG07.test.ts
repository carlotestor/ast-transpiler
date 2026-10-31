import { Transpiler } from '../src/transpiler';

const PRELUDE = 'type Dict = { [key: string]: any };\n'
    + 'type Str = string | undefined;\ntype Int = number | undefined;\ntype Bool = boolean | undefined;\n'
    + 'class Base {\n'
    + '    handleParamString (params: Dict, name: string, d?: string): [Str, Dict] { return [ undefined, params ]; }\n'
    + '    handleParamBool (params: Dict, name: string, d?: boolean): [Bool, Dict] { return [ undefined, params ]; }\n'
    + '    handleParamInteger (params: Dict, name: string, d?: number): [Int, Dict] { return [ undefined, params ]; }\n'
    + '    handleOptionBoolAndParams (params: Dict, m: string, o: string, d?: boolean): [Bool, Dict] { return [ undefined, params ]; }\n'
    + '    handleOptionIntegerAndParams (params: Dict, m: string, o: string, d?: number): [Int, Dict] { return [ undefined, params ]; }\n'
    + '    checkAddress (a: any, c?: any, t?: any): any { return a; }\n'
    + '    other (a: any): any { return a; }\n'
    + '}\n';

const go = (body: string): string => new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } })
    .transpileGo(PRELUDE + 'class V extends Base {\n' + body + '}\n').content;

const fn = (decl: string, uses: string): string => go('    f (address: string, params: Dict = {}): any {\n        const request: Dict = {};\n'
    + decl + uses + '        return request;\n    }\n');

const TAG = "        const [ tag, paramsTag ] = this.handleParamString (params, 'tag');\n";

describe('hx11 fold 1F G07: tuple slot 0 of the pointer helpers is the typed pointer', () => {
    test('nil test, guarded map store, literal compare and a deref-ing callee keep the pointer', () => {
        const out = fn(TAG, "        this.checkAddress (address, 'c', tag);\n        if (tag !== undefined) {\n            request['memo'] = tag;\n        }\n        if (tag === 'x') {\n            request['y'] = 1;\n        }\n");
        expect(out).toContain('var tag *string = nil');
        expect(out).toContain('if p, ok := tagparamsTagVariable[0].(*string); ok { tag = p }');
        expect(out).toContain('request["memo"] = *tag');
        expect(out).toContain('tag != nil && *tag == "x"');
        expect(out).not.toContain('tag := GetValue(');
    });
    test('an exiting nil guard proves the store', () => {
        const out = fn(TAG, "        if (tag === undefined) {\n            return undefined;\n        }\n        request['memo'] = tag;\n");
        expect(out).toContain('request["memo"] = *tag');
    });
    test('an int64 option slot is the pointer', () => {
        const out = fn("        const [ until, paramsUntil ] = this.handleOptionIntegerAndParams (params, 'f', 'until');\n",
            "        if (until !== undefined) {\n            request['endTime'] = until;\n        }\n");
        expect(out).toContain('var until *int64 = nil');
        expect(out).toContain('.(*int64); ok { until = p }');
        expect(out).toContain('request["endTime"] = *until');
    });
    test('the assignment form of a nil-initialised bool local is the pointer', () => {
        const out = fn("        let hedged: Bool = undefined;\n        [ hedged, params ] = this.handleParamBool (params, 'hedged', false);\n",
            "        if ((hedged === true) || request['a']) {\n            request['h'] = 1;\n        }\n");
        expect(out).toContain('var hedged *bool = nil');
        expect(out).toContain('.(*bool); ok { hedged = p }');
        expect(out).toContain('hedged != nil && *hedged == true');
        expect(out).not.toContain('hedged = GetValue(');
    });
    test('a store without a nil proof keeps the box', () => {
        const out = fn(TAG, "        request['memo'] = tag;\n");
        expect(out).toContain('tag := GetValue(tagparamsTagVariable, 0)');
        expect(out).not.toContain('var tag *string');
    });
    test('an object literal value, a return and a foreign callee keep the box', () => {
        for (const use of [ "        request['o'] = { 'k': tag };\n", '        return tag;\n', '        this.other (tag);\n' ]) {
            const out = fn(TAG, use);
            expect(out).toContain('tag := GetValue(tagparamsTagVariable, 0)');
        }
    });
    test('a later write keeps the box', () => {
        const out = fn(TAG, "        tag = 'z';\n        this.checkAddress (address, 'c', tag);\n");
        expect(out).not.toContain('var tag *string');
    });
    test('a literal default selects the native pair twin: no pointer slot', () => {
        const out = fn("        const [ flag, paramsFlag ] = this.handleOptionBoolAndParams (params, 'f', 'flag', false);\n",
            "        if (flag === true) {\n            request['x'] = 1;\n        }\n");
        expect(out).not.toContain('var flag *bool');
    });
});
