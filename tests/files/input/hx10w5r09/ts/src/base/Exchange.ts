export interface Dict { [key: string]: any }
export default class Exchange {
    options: Dict = {};
    isPostOnly (isMarketOrder: boolean, params: Dict = {}): boolean {
        return isMarketOrder;
    }
}
