import Exchange from './base/Exchange.js';
export default class venue extends Exchange {
    // required bool parameter: the native-`bool` slot a local may flow into
    settle (isMarket: boolean, amount: any) {
        if (isMarket) {
            return -amount;
        }
        return amount;
    }
    // a bool local from a comparison, read in condition slots AND a native-`bool` slot
    localIntoBoolSlot (type: string) {
        const isMarket = (type === 'market');
        if (!isMarket) {
            return 0;
        }
        if (isMarket && (type === 'x')) {
            return 1;
        }
        return this.settle (isMarket, 2);
    }
    // a comparison local read only in conditions stays typed (no regression)
    localConditionsOnly (type: string) {
        const isSpot = (type === 'spot');
        if (isSpot) {
            return 1;
        }
        return 0;
    }
    // negative: a Value slot keeps the box
    localIntoValueSlot (type: string) {
        const isWide = (type === 'spot');
        const held = [ isWide ];
        return held;
    }
    // negative: a `Value` read into the bool slot still coerces
    valueIntoBoolSlot (raw: any) {
        return this.settle (raw, 3);
    }
}
