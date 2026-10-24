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
}
