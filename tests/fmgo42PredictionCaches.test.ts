import { Transpiler } from '../src/transpiler';

// FM-GO4-2 (folds ccxt hx10w3-G09): the PredictionExchange caches are `map[string]any` struct fields,
// so a site that proves its key is a Go string reads and writes them natively. Keyed on the declaring class.

let transpiler: Transpiler;

beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

const PRELUDE = 'type Str = string | undefined;\n' +
    'type Dict = {[key: string]: any};\n' +
    'class PredictionExchange {\n' +
    '    outcomes: Dict = undefined;\n' +
    '    outcomes_by_id: Dict = undefined;\n' +
    '    events: Dict = undefined;\n' +
    '    events_by_slug: Dict = undefined;\n' +
    '    safeString (a: any, b: any, c?: string): Str { return undefined; }\n' +
    '    safeValue (a: any, b: any): any { return undefined; }\n' +
    '}\n' +
    'class Other {\n' +
    '    events: Dict = undefined;\n' +
    '    safeString (a: any, b: any, c?: string): Str { return undefined; }\n' +
    '}\n';

function go(body: string, base = 'PredictionExchange'): string {
    return transpiler.transpileGo(PRELUDE + 'class Test extends ' + base + ' {\n' + body + '}\n').content;
}

const INIT = '        if (this.events === undefined) {\n            this.events = {};\n        }\n';

describe('fm-go4-2 prediction cache fields', () => {
    test('a nil-guarded *string key stores natively once the cache is initialised', () => {
        const out = go('    main (event: any) {\n' + INIT +
            '        const id = this.safeString (event, "id");\n' +
            '        if (id !== undefined) {\n' +
            '            this.events[id] = event;\n' +
            '        }\n' +
            '    }\n');
        expect(out).toContain('this.Events[*id] = event');
        expect(out).not.toContain('AddElementToObject(this.Events');
    });
    test('a string literal key stores natively', () => {
        const out = go('    main (event: any) {\n' + INIT + '        this.events["x"] = event;\n    }\n');
        expect(out).toContain('this.Events["x"] = event');
    });
    test('an unguarded pointer key keeps the helper', () => {
        const out = go('    main (event: any) {\n' + INIT +
            '        const id = this.safeString (event, "id");\n' +
            '        this.events[id] = event;\n' +
            '    }\n');
        expect(out).toContain('AddElementToObject(this.Events, id, event)');
    });
    test('an uninitialised cache keeps the helper (a nil map write panics, the helper no-ops)', () => {
        const out = go('    main (event: any) {\n' +
            '        const id = this.safeString (event, "id");\n' +
            '        if (id !== undefined) {\n' +
            '            this.events[id] = event;\n' +
            '        }\n' +
            '    }\n');
        expect(out).toContain('AddElementToObject(this.Events, id, event)');
    });
    test('a cache that is also reassigned to a non-literal keeps the helper', () => {
        const out = go('    main (event: any, other: any) {\n' + INIT +
            '        this.events = other;\n' +
            '        const id = this.safeString (event, "id");\n' +
            '        if (id !== undefined) {\n' +
            '            this.events[id] = event;\n' +
            '        }\n' +
            '    }\n');
        expect(out).toContain('AddElementToObject(this.Events, id, event)');
    });
    test('a pointer-holding value keeps the helper', () => {
        const out = go('    main (event: any) {\n' + INIT +
            '        const id = this.safeString (event, "id");\n' +
            '        if (id !== undefined) {\n' +
            '            this.events[id] = this.safeString (event, "slug");\n' +
            '        }\n' +
            '    }\n');
        expect(out).toContain('AddElementToObject(this.Events, id,');
    });
    test('a same-named field of another class is not the cache', () => {
        const out = go('    main (event: any) {\n' +
            '        if (this.events === undefined) {\n            this.events = {};\n        }\n' +
            '        this.events["x"] = event;\n' +
            '    }\n', 'Other');
        expect(out).toContain('AddElementToObject(this.Events, "x", event)');
    });
    test('nil tests print natively', () => {
        const out = go('    main () {\n' +
            '        if (this.events === undefined) {\n            return 1;\n        }\n' +
            '        if (this.events_by_slug !== undefined) {\n            return 2;\n        }\n' +
            '        return 3;\n' +
            '    }\n');
        expect(out).toContain('this.Events == nil');
        expect(out).toContain('this.Events_by_slug != nil');
        expect(out).not.toContain('IsEqual(this.Events');
    });
    test('a duplicated nil test collapses to one', () => {
        const out = go('    main (reload: boolean) {\n' +
            '        if (!reload && (this.events !== undefined && this.events !== null)) {\n            return 1;\n        }\n' +
            '        return 3;\n' +
            '    }\n');
        expect(out).not.toContain('IsEqual(this.Events');
        expect(out).not.toContain('(this.Events != nil) && (this.Events != nil)');
        expect(out).toContain('this.Events != nil');
    });
    test('a string-literal key and a loop-bounded key read natively', () => {
        const out = go('    main () {\n' +
            '        const one = this.events["a"];\n' +
            '        const keys = Object.keys (this.events);\n' +
            '        for (let i = 0; i < keys.length; i++) {\n' +
            '            const event = this.events[keys[i]];\n' +
            '        }\n' +
            '        return one;\n' +
            '    }\n');
        expect(out).toContain('this.Events["a"]');
        expect(out).toContain('this.Events[keys[i]]');
        expect(out).not.toContain('GetValue(this.Events');
    });
    test('an any key keeps GetValue', () => {
        const out = go('    main (key: any) {\n        return this.events[key];\n    }\n');
        expect(out).toContain('GetValue(this.Events, key)');
    });
    test('another class keeps the helper reads and nil test', () => {
        const out = go('    main () {\n' +
            '        if (this.events === undefined) {\n            return 1;\n        }\n' +
            '        return this.events["a"];\n' +
            '    }\n', 'Other');
        expect(out).toContain('IsEqual(this.Events, nil)');
        expect(out).toContain('GetValue(this.Events, "a")');
    });
});
