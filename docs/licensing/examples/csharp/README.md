# C# licensing verifier

The reference uses C# 12 on .NET 8 or later and the Linux system OpenSSL 3 library (`libcrypto.so.3`). It uses no NuGet packages. For other platforms, replace the small `Ed25519.Verify` backend with a vetted implementation such as NSec or Bouncy Castle. The backend must verify pure Ed25519 over the original message bytes. See [OpenSSL's Ed25519 documentation](https://docs.openssl.org/3.0/man7/EVP_PKEY-ED25519/) and its [one-shot verification API](https://docs.openssl.org/3.0/man3/EVP_DigestVerifyInit/).

From the repository root on a suitable Linux host, run the console example against the published vectors.

```sh
repo="$PWD"
work="$(mktemp -d)"
dotnet new console --framework net8.0 --output "$work"
cp "$repo"/docs/licensing/examples/csharp/*.cs "$work"/
dotnet run --project "$work" -- "$repo/docs/licensing/test-vectors.json"
```

In an application, construct `Pin` from a vendor-controlled trust channel and supply revocations through that channel. `VerifyResponse` takes the request nonce, HTTP status, `SM-Key-Id`, `SM-Response-Signature` and the raw decompressed body. Verify before reading any JSON. `VerifyLease` returns authenticated claims for the expected binding and time. During enrollment, use the activation ID from the verified POST response and pass a null license ID, then persist the returned `lid` for subsequent checks. Derive the expected `dkt` with `Thumbprint` over the local raw device public key.

See the [integration guide](../../client-integration.md) for the network flow and offline policy.
