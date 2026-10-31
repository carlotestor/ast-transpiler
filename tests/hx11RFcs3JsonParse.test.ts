import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({ __esModule: true, default: jest.fn() }));

const config = { 'verbose': false, 'csharp': { 'parser': { 'NUM_LINES_END_FILE': 0 } } };
const print = (src: string) => new Transpiler(config).transpileCSharp(src).content;

describe('csharp JSON.parse on a string-declared read', () => {
    test('a string local calls the deserializer directly', () => {
        const out = print('class T {\n    f () {\n        const s = \'{}\';\n        return JSON.parse (s);\n    }\n}');
        expect(out).toContain('JsonHelper.Deserialize(s)');
    });
    test('an untyped parameter keeps the helper', () => {
        const out = print('class T {\n    f (s) {\n        return JSON.parse (s);\n    }\n}');
        expect(out).toContain('parseJson(s)');
        expect(out).not.toContain('JsonHelper');
    });
});
