export interface Dict { [key: string]: any }
export default class Exchange {
    options: Dict = {};
    setSandboxMode (enabled: boolean) {
        if (enabled) {
            this.options['sandbox'] = true;
        }
    }
    isPostOnly (isMarketOrder: boolean, params: Dict = {}): boolean {
        return isMarketOrder;
    }
    hold (f: any): any {
        return f;
    }
}
