export interface Dict { [key: string]: any }
export default class Exchange {
    extend (...args: any[]): Dict {
        return Object.assign ({}, ...args);
    }
    omit (x: Dict | undefined, ...args: any): any {
        return x;
    }
    keysort (x: Dict | undefined): Dict {
        return x;
    }
}
