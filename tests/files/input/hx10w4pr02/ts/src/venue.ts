import Exchange from './base/Exchange.js';
export default class venue extends Exchange {
    // required `boolean` read only in condition slots -> native `bool`
    settlementData (isBuy: boolean, amount: any) {
        if (isBuy) {
            return -amount;
        }
        return amount;
    }
    // optional `boolean`: bound with the truthiness the use sites applied
    starkAmount (amount: any, roundUp: boolean = false) {
        if (roundUp) {
            return amount + 1;
        }
        return amount;
    }
    // a bool parameter forwarded into a native-`bool` slot
    forwarded (on: boolean) {
        return this.settlementData (on, 1);
    }
    // a `Value` argument coerces at the call site
    fromValue (raw: any) {
        return this.settlementData (raw, 2);
    }
    // a bool parameter read outside a bool sink keeps the box
    boxed (flag: boolean) {
        const held = flag;
        return held;
    }
    // an override keeps the base `Value` signature
    override setSandboxMode (enabled: boolean) {
        if (enabled) {
            this.options['demo'] = true;
        }
    }
    // a method reference handed to another call keeps the `Value` signature
    channelB (flag: boolean) {
        if (flag) {
            return 1;
        }
        return 2;
    }
    holdRef () {
        return this.hold (this.channelB);
    }
}
