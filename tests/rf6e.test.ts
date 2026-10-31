import { Transpiler } from '../src/transpiler';

// RF-go-6-E: (1) a base field the consumer declares as owned by a dispatch loop is read through the
// owner's accessor off the loop; (2) the stdlib imports a printed file needed are reported with it.

const OWNED = {
    'fields': { 'clients': { 'owner': 'BaseExchange', 'snapshot': 'WsClientsSnapshot', 'remove': 'WsClientRemove' } },
    'loopMethods': '^(?:handle\\w*|isOrderBookDeltaInSequence)$',
};

const SOURCE =
    'type Dictionary<T> = { [key: string]: T };\n' +
    'class WsClient { url: string = ""; }\n' +
    'class BaseExchange {\n' +
    '    clients: Dictionary<WsClient> = {};\n' +
    '    safeValue (o: any, k: string): any { return undefined; }\n' +
    '}\n' +
    'class ex extends BaseExchange {\n' +
    '    clients2: Dictionary<WsClient> = {};\n' +
    '    walk (): any {\n' +
    '        const all = Object.values (this.clients);\n' +
    '        return all;\n' +
    '    }\n' +
    '    has (url: string): boolean {\n' +
    '        return url in this.clients;\n' +
    '    }\n' +
    '    find (url: string): any {\n' +
    '        return this.safeValue (this.clients, url);\n' +
    '    }\n' +
    '    drop (url: string): void {\n' +
    '        delete this.clients[url];\n' +
    '    }\n' +
    '    handleMessage (url: string): void {\n' +
    '        const all = Object.values (this.clients);\n' +
    '        delete this.clients[url];\n' +
    '    }\n' +
    '    reset (): void {\n' +
    '        this.clients = {};\n' +
    '    }\n' +
    '    other (): any {\n' +
    '        return Object.values (this.clients2);\n' +
    '    }\n' +
    '}\n';

const go = (owned: any, source = SOURCE): string => {
    const config: any = { 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } };
    if (owned !== undefined) {
        config.go.ownedFields = owned;
    }
    return new Transpiler(config).transpileGo(source).content;
};

const method = (out: string, name: string): string => {
    const at = out.indexOf('func (this *ex) ' + name + '(');
    expect(at).toBeGreaterThanOrEqual(0);
    const next = out.indexOf('\nfunc ', at + 1);
    return out.substring(at, next < 0 ? out.length : next);
};

describe('RF-go-6-E owned base fields', () => {
    test('reads off the loop ask the owner (fails on the unconfigured printer)', () => {
        const base = go(undefined);
        expect(method(base, 'Walk')).toContain('ObjectValues(this.Clients)');
        const out = go(OWNED);
        expect(method(out, 'Walk')).toContain('ObjectValues(this.WsClientsSnapshot())');
        expect(method(out, 'Walk')).not.toContain('this.Clients');
        expect(method(out, 'Has')).toContain('this.WsClientsSnapshot()');
        expect(method(out, 'Find')).toContain('this.SafeValue(this.WsClientsSnapshot(), url)');
    });

    test('a delete off the loop is the owner remove op', () => {
        const base = go(undefined);
        expect(method(base, 'Drop')).toContain('Remove(this.Clients, url)');
        const out = go(OWNED);
        expect(method(out, 'Drop')).toContain('this.WsClientRemove(url)');
        expect(method(out, 'Drop')).not.toContain('Remove(this.Clients');
    });

    test('code on the loop keeps the field (handler methods)', () => {
        const out = method(go(OWNED), 'HandleMessage');
        expect(out).toContain('ObjectValues(this.Clients)');
        expect(out).toContain('Remove(this.Clients, url)');
        expect(out).not.toContain('WsClient');
    });

    test('a whole-field write keeps the field', () => {
        const out = method(go(OWNED), 'Reset');
        expect(out).toContain('this.Clients = ');
        expect(out).not.toContain('WsClientsSnapshot');
    });

    test('a field of the same name that another class declares is not owned', () => {
        const out = method(go(OWNED), 'Other');
        expect(out).toContain('this.Clients2');
        expect(out).not.toContain('WsClientsSnapshot');
        const shadow = go(OWNED,
            'type Dictionary<T> = { [key: string]: T };\n' +
            'class Mine { clients: Dictionary<number> = {}; }\n' +
            'class ex extends Mine {\n' +
            '    walk (): any {\n' +
            '        return Object.values (this.clients);\n' +
            '    }\n' +
            '}\n');
        expect(shadow).toContain('ObjectValues(this.Clients)');
        expect(shadow).not.toContain('WsClientsSnapshot');
    });
});

describe('RF-go-6-E reported stdlib imports', () => {
    const FILE =
        'class ex {\n' +
        '    run (a: any): string {\n' +
        '        const n = Object.keys (a).length;\n' +
        '        return n.toString ();\n' +
        '    }\n' +
        '}\n';

    test('the printed file reports the packages it needed (fails on the base printer: no report)', () => {
        const out = new Transpiler({ 'verbose': false, 'go': {} }).transpileGo(FILE);
        expect(out.content).toContain('strconv.Itoa(n)');
        expect(out.goStdlibImports).toEqual(['strconv']);
    });

    test('a file with no native stdlib call reports nothing', () => {
        const out = new Transpiler({ 'verbose': false, 'go': {} }).transpileGo('class ex {\n    run (a: any): any {\n        return a;\n    }\n}\n');
        expect(out.goStdlibImports).toEqual([]);
    });

    test('code inside a skipped region asks for no import', () => {
        const source =
            'class ex {\n' +
            '    run (a: any): string {\n' +
            '        const n = Object.keys (a).length;\n' +
            '        // @SKIP_START_GO\n' +
            '        const s = n.toString ();\n' +
            '        // @SKIP_END_GO\n' +
            '        return "x";\n' +
            '    }\n' +
            '}\n';
        const plain = new Transpiler({ 'verbose': false, 'go': {} }).transpileGo(source);
        expect(plain.goStdlibImports).toEqual(['strconv']);
        const skipping = new Transpiler({ 'verbose': false, 'go': { 'skipRegionMarkers': [ '@SKIP_START_GO', '@SKIP_END_GO' ] } }).transpileGo(source);
        expect(skipping.goStdlibImports).toEqual([]);
        expect(skipping.content).toContain('ToString(n)');
    });
});
