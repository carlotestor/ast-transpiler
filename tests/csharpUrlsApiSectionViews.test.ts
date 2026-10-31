import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

const config = {
    'verbose': false,
    'csharp': { 'parser': { 'NUM_LINES_END_FILE': 0, 'ELEMENT_ACCESS_WRAPPER_OPEN': 'getValue(', 'ELEMENT_ACCESS_WRAPPER_CLOSE': ')' } }
};

const klass = (body: string) => [
    'class Exchange {',
    '    urls: any;',
    '    other: any;',
    '    f (type: string, newUrls: any) {',
    body,
    '    }',
    '}',
].join('\n');

const printed = (body: string): string => new Transpiler(config).transpileCSharp(klass(body)).content;

const WS_PUBLIC = '(this.urlsApiSections.ContainsKey("ws") && this.urlsApiSections["ws"].ContainsKey("public") ? this.urlsApiSections["ws"]["public"] : null)';

describe('csharp urls[\'api\'] section views', () => {
    test('a literal section/key read is the urlsApiSections chain', () => {
        const out = printed('        const a = this.urls[\'api\'][\'ws\'][\'public\'];\n        return a;');
        expect(out).toContain(`object a = ${WS_PUBLIC};`);
        expect(out).not.toContain('getValue(');
    });

    test('parentheses and assertions around the operands print as the operand', () => {
        const out = printed('        const a = ((this.urls[\'api\'] as any)[\'ws\'] as any)[\'public\'];\n        return a;');
        expect(out).toContain(WS_PUBLIC);
    });

    test('a non-literal section or key, or another urls entry, keeps the helper', () => {
        expect(printed('        return this.urls[\'api\'][type][\'public\'];')).not.toContain('urlsApiSections');
        expect(printed('        return this.urls[\'api\'][\'ws\'][type];')).not.toContain('urlsApiSections');
        expect(printed('        return this.urls[\'test\'][\'ws\'][\'public\'];')).not.toContain('urlsApiSections');
        expect(printed('        return this.other[\'api\'][\'ws\'][\'public\'];')).not.toContain('urlsApiSections');
    });

    test('a write target is never the view', () => {
        const out = printed('        this.urls[\'api\'][\'ws\'][\'public\'] = type;');
        expect(out).not.toContain('urlsApiSections');
    });

    test('a write of urls or of one entry refreshes the views right after the statement', () => {
        const out = printed('        this.urls[\'api\'] = this.urls[\'test\'];\n        this.urls = newUrls;\n        return 1;');
        expect(out).toMatch(/\["api"\] = [^\n]*;\n {8}this\.RefreshUrlsViews\(\);\n {8}this\.urls = newUrls;/);
        expect(out).toContain('this.urls = newUrls;\n        this.RefreshUrlsViews();\n        return 1;');
    });

    test('reads, comparisons and other members are no urls write', () => {
        const out = printed('        const a = this.urls;\n        this.other = newUrls;\n        this.other[\'urls\'] = type;\n        return a;');
        expect(out).not.toContain('RefreshUrlsViews');
    });
});
