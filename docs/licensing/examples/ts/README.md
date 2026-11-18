# TypeScript licensing verifier

`verify.ts` uses Node’s built-in crypto APIs. Supply vendor-pinned keys and revocations. Call `verifyResponse` on decompressed body bytes before parsing the JSON, then call `verifyLease` with the local binding and current Unix seconds. Omit the expected license ID only for a verified initial activation response. Store the returned license ID for all later checks.

The shared vector checks run with `pnpm test tests/unit/licensing-client-reference.test.ts`. See the [integration guide](../../client-integration.md) for the complete flow.
