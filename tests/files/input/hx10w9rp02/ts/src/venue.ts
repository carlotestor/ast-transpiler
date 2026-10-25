interface Dictionary<T> {
    [key: string]: T;
}
type Dict = Dictionary<any>;

class venue {
    omit (a: any, b: any): any {
        return a;
    }

    watch (a: any, b: any, c: any): any {
        return a;
    }

    // hx10w9 RP02: a `Dict` parameter written by literal key, called only with a
    // typed dict bearer -> `&mut IndexMap` and a bare `.insert`.
    orderRequest (method: string, request: Dict, orderParams: Dict, params: Dict = {}): [Dict, Dict] {
        if (method === 'create') {
            orderParams['limit_price'] = this.omit (params, []);
        }
        orderParams['order_type'] = method;
        request['params'] = orderParams;
        const omitted: Dict = this.omit (params, []);
        return [ request, omitted ];
    }

    createOrder (type: string, params: Dict = {}) {
        const orderParams: Dict = {
            'order_type': type,
            'order_qty': 1,
        };
        const request: Dict = {
            'method': 'add_order',
            'params': orderParams,
        };
        const [ requestValue, paramsValue ] = this.orderRequest ('create', request, orderParams, params);
        return this.watch ('url', 'hash', this.omit (requestValue, paramsValue));
    }

    // A caller that passes a non-bearer keeps the boxed parameter.
    plainCreate (params: Dict = {}) {
        const request: Dict = { 'method': 'add_order' };
        return this.plainOrder ('create', request, params, params);
    }

    plainOrder (method: string, request: Dict, orderParams: Dict, params: Dict = {}): [Dict, Dict] {
        orderParams['order_type'] = method;
        request['params'] = orderParams;
        return [ request, params ];
    }

    // A read-only `Dict` parameter keeps the D-25 borrowed shadow.
    readOnly (orderParams: Dict): any {
        return orderParams['order_type'];
    }
}

class second {
    extend (a: any, b: any = undefined): any {
        return a;
    }

    safeInteger (a: any, b: any): any {
        return 1;
    }

    postAction (operationType: string, sigPayload: Dict, params: Dict): Dict {
        sigPayload['builder_code'] = operationType;
        const finalHeaders: Dict = { };
        finalHeaders['account'] = operationType;
        const request = this.extend (finalHeaders, sigPayload);
        return request;
    }

    caller (type: string, params: Dict = {}) {
        const sigPayload: Dict = { 'amount': 1 };
        sigPayload['exclude'] = type;
        return this.postAction ('op', sigPayload, params);
    }
}

class nested {
    omit (a: any, b: any): any {
        return a;
    }

    build (orderParams: Dict, params: Dict): Dict {
        orderParams['type'] = 'market';
        const triggers: Dict = {};
        triggers['price'] = '1';
        triggers['price_type'] = 'quote';
        orderParams['triggers'] = triggers;
        return this.omit (orderParams, params);
    }

    caller (params: Dict = {}) {
        const orderParams: Dict = { 'qty': 1 };
        const request: Dict = { 'params': orderParams };
        const [ value, rest ] = [ this.build (orderParams, params), params ];
        return this.omit (request, rest);
    }
}
