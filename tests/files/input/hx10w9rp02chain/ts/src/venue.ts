interface Dictionary<T> {
    [key: string]: T;
}
type Dict = Dictionary<any>;

class venue {
    // a key-chain write has no native print on a map parameter, so the parameter stays boxed
    watchMany (request: Dict, ids: string[]) {
        request['type'] = 'SUBSCRIBE';
        request['channels'][0]['codes'] = ids;
        return request;
    }

    watch (ids: string[]) {
        const request: Dict = {
            'channels': [ {} ],
        };
        return this.watchMany (request, ids);
    }
}

export default venue;
