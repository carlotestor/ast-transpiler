import { Exchange } from './base/Exchange';
type Dict = { [key: string]: any };
export class ex extends Exchange {
    parseData (data: Dict) {
        return data['a'];
    }
}
