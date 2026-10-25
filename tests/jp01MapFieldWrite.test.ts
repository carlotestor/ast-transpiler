import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

let transpiler: Transpiler;

beforeAll(() => {
    transpiler = new Transpiler({ verbose: false, java: { parser: { NUM_LINES_END_FILE: 0 } } });
});

const java = (body: string, members = ''): string => {
    const input = 'class T {\n' + members + '    test (): void {\n' + body + '    }\n}\n';
    return transpiler.transpileJava(input).content;
};

describe('hx10w9 JP01: element writes into the base header map fields', () => {

    test('options takes the native put on a non-null value', () => {
        const output = java('        this.options["sandboxMode"] = true;\n');
        expect(output).toContain('this.options.put("sandboxMode", true);');
        expect(output).not.toContain('addElementToObject');
    });

    test('every header map field is covered, not just options', () => {
        for (const field of [ 'balance', 'tickers', 'orderbooks', 'urls', 'has', 'features', 'headers', 'trades', 'ohlcvs', 'markets', 'markets_by_id', 'commonCurrencies', 'exceptions', 'api', 'baseCurrencies', 'quoteCurrencies', 'transformedApi', 'userAgents', 'bidsasks', 'fundingRates' ]) {
            const output = java(`        this.${field}["x"] = 1;\n`);
            expect(output).toContain(`this.${field}.put("x", 1);`);
        }
    });

    test('a non-null dict parameter keeps the put', () => {
        const input = 'class T {\n'
            + '    test (parameters: { [key: string]: any }): void {\n'
            + '        this.balance["info"] = parameters;\n'
            + '    }\n'
            + '}\n';
        const output = transpiler.transpileJava(input).content;
        expect(output).toContain('this.balance.put("info", parameters);');
        expect(output).not.toContain('addElementToObject');
    });

    test('a nullable value keeps the helper (its ConcurrentHashMap null branch removes)', () => {
        const output = java(
            '        const value: { [key: string]: any } | undefined = undefined;\n' +
            '        this.tickers["x"] = value;\n');
        expect(output).toContain('Helpers.addElementToObject(this.tickers, "x", value)');
    });

    test('the null literal keeps the helper', () => {
        const output = java('        this.tickers["x"] = null;\n');
        expect(output).toContain('Helpers.addElementToObject(this.tickers, "x", null)');
    });

    test('a numeric key keeps the helper (put takes the String key)', () => {
        const output = java('        this.tickers[0] = 1;\n');
        expect(output).toContain('Helpers.addElementToObject(this.tickers, 0, 1)');
    });

    test('a nested write keeps the helper (the inner map is a read result)', () => {
        const output = java('        this.tickers[symbol]["x"] = 1;\n', '    symbol (): string { return "s"; }\n');
        expect(output).toContain('Helpers.addElementToObject');
    });

    test('a field the base does not declare a map keeps the helper', () => {
        const output = java('        this.notAHeaderField["x"] = 1;\n');
        expect(output).toContain('Helpers.addElementToObject(this.notAHeaderField, "x", 1)');
    });

    test('the value position keeps the helper (the write is a statement, not an expression)', () => {
        const output = java('        const x = this.tickers[this.symbol()] = 1;\n', '    symbol (): string { return "s"; }\n');
        expect(output).toContain('Helpers.addElementToObject');
    });
});
