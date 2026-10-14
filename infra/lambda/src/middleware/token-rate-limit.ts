/** Retired Redis limiter: never permit an old caller to bypass the credit ledger. */
export function estimateTokens(text: string): number { return Math.ceil(text.length / 3) + 50; }
export async function checkTokenLimit(..._args: unknown[]): Promise<never> { throw new Error("Use billing/store reserveAI before model invocation"); }
export async function getTokenUsage(..._args: unknown[]): Promise<never> { throw new Error("Use the authenticated billing wallet endpoint"); }
export async function withTokenLimit(..._args: unknown[]): Promise<never> { throw new Error("Use billing/store reserveAI and finishAI"); }
