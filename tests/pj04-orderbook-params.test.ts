import { Transpiler } from '../src/transpiler';
import fs from 'fs';
import path from 'path';

// PJ04: a WsOrderBook-typed parameter prints the ws order book class, its literal-key reads go
// native, and an Object argument at the call site carries the checkcast.
describe('WsOrderBook parameters (hx10w4 PJ04)', () => {
    const TMP = path.join(__dirname, 'files', 'tmp-pj04-orderbook');
    const BOOK_FIXTURE = path.join(TMP, 'ts', 'src', 'base', 'ws', 'OrderBook.ts');
    const VENUE_FIXTURE = path.join(TMP, 'ts', 'src', 'probe.ts');
    let venueOutput: string;
    let baseOutput: string;

    beforeAll(() => {
        fs.mkdirSync(path.dirname(BOOK_FIXTURE), { recursive: true });
        fs.writeFileSync(BOOK_FIXTURE,
            "export class OrderBook {\n" +
            "    symbol: string = undefined;\n" +
            "    asks: any = undefined;\n" +
            "    bids: any = undefined;\n" +
            "    get (key: string): any { return undefined; }\n" +
            "    put (key: string, value: any): void {}\n" +
            "}\n" +
            "export { OrderBook as WsOrderBook };\n");
        fs.writeFileSync(VENUE_FIXTURE,
            "import { WsOrderBook } from './base/ws/OrderBook';\n" +
            "class Venue {\n" +
            "    handleBookDelta (orderbook: WsOrderBook, delta: any): void {\n" +
            "        const asks = orderbook['asks'];\n" +
            "        orderbook['nonce'] = delta;\n" +
            "        const other = orderbook['symbol'];\n" +
            "    }\n" +
            "    untyped (orderbook: any): void {\n" +
            "        const asks = orderbook['asks'];\n" +
            "    }\n" +
            "    caller (box: any): void {\n" +
            "        const book: WsOrderBook = box;\n" +
            "        this.handleBookDelta(book, 1);\n" +
            "        this.handleBookDelta(box, 1);\n" +
            "    }\n" +
            "    pass (orderbook: WsOrderBook, delta: any): void {\n" +
            "        this.handleBookDelta(orderbook, delta);\n" +
            "    }\n" +
            "}\n");
        const byPath = new Transpiler({ 'verbose': false, 'java': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
        venueOutput = byPath.transpileJavaByPath(VENUE_FIXTURE).content;
        baseOutput = '';
    });

    afterAll(() => {
        fs.rmSync(TMP, { recursive: true, force: true });
    });

    test('the annotated parameter prints the order book class', () => {
        expect(venueOutput).toContain('public void handleBookDelta(io.github.ccxt.ws.WsOrderBook orderbook, Object delta)');
    });

    test('an any-annotated parameter keeps Object', () => {
        expect(venueOutput).toContain('public void untyped(Object orderbook)');
    });

    test('a literal read of a known key binds the class getter with the null guard', () => {
        expect(venueOutput).toContain('(orderbook == null ? null : orderbook.get("asks"))');
    });

    test('a key the class does not declare keeps the helper', () => {
        expect(venueOutput).toContain('Helpers.GetValue(orderbook, "symbol")');
    });

    test('an Object argument gets the checkcast, a same-typed parameter does not', () => {
        expect(venueOutput).toContain('this.handleBookDelta((io.github.ccxt.ws.WsOrderBook) (box), 1)');
        // a local whose declaration still prints Object keeps its checkcast
        expect(venueOutput).toContain('this.handleBookDelta((io.github.ccxt.ws.WsOrderBook) (book), 1)');
        expect(venueOutput).toContain('this.handleBookDelta(orderbook, delta)');
    });
});
