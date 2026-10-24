interface Dictionary<T> {
    [key: string]: T;
}
type Dict = Dictionary<any>;

class venue {
    extend (a: any, b: any): any {
        return a;
    }

    use (a: any): any {
        return a;
    }

    parseNestedAction (params: Dict = {}, vault: any = undefined) {
        const orderAction: Dict = { 'type': 'order' };
        orderAction['orders'] = [ this.use (params) ];
        if (vault !== undefined) {
            orderAction['vault'] = vault;
        }
        const signature = this.use (orderAction);
        return { 'action': orderAction, 'signature': signature };
    }

    parseSingleMove (params: Dict = {}) {
        const request: Dict = { 'limit': 10 };
        request['type'] = 'limit';
        return this.use (request);
    }

    parseReassigned (params: Dict = {}) {
        let query: Dict = { 'limit': 10 };
        query = this.extend (query, params);
        return this.use (query);
    }

    parseCaptured (params: Dict = {}) {
        const seen: Dict = {};
        seen['a'] = true;
        return [ 1, 2 ].map ((x) => this.use (seen) as any);
    }

    parseShorthand (params: Dict = {}) {
        const inner: Dict = { 'a': 1 };
        return { inner };
    }
}
