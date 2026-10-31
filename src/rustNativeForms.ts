// ── RF-rust-1: type-keyed native forms (formerly post-print passes in ccxt build/rustTranspiler.ts) ──
// A plain place path (`a`, `self.a.b`): side-effect-free, so it may be read twice or evaluated eagerly.
export const RUST_PLAIN_PLACE = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
