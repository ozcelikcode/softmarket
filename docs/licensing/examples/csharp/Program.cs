using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using SoftMarket.Licensing;

if (args.Length != 1) throw new ArgumentException("Supply the path to test-vectors.json.");

using var vectors = JsonDocument.Parse(File.ReadAllBytes(args[0]));
var root = vectors.RootElement;
var key = root.GetProperty("signingKey");
var pin = new Pin(Text(key, "kid"), Text(key, "publicKey"));
var verifier = new SoftMarketVerifier([pin]);
var lease = root.GetProperty("lease");
var response = root.GetProperty("response");
var expected = lease.GetProperty("expected");
var identity = new Identity(Text(expected, "iss"), Text(expected, "aud"), Text(expected, "sub"),
    Text(expected, "lid"), Text(expected, "fp"), Text(expected, "dkt"));
long now = lease.GetProperty("now").GetInt64();
int status = response.GetProperty("status").GetInt32();
string signature = Text(response, "signature"), nonce = Text(response, "nonce");
byte[] body = Encoding.UTF8.GetBytes(Text(response, "bodyUtf8"));

var claims = verifier.VerifyLease(Text(lease, "token"), identity, now);
if (claims is null || !JsonNode.DeepEquals(JsonNode.Parse(claims.Value.GetRawText()), JsonNode.Parse(lease.GetProperty("claims").GetRawText()))
    || verifier.VerifyLease(Text(lease, "token"), identity, lease.GetProperty("claims").GetProperty("exp").GetInt64()) is not null
    || !verifier.VerifyResponse(status, nonce, pin.Kid, signature, body, now)
    || verifier.VerifyResponse(403, nonce, pin.Kid, signature, body, now))
    throw new InvalidOperationException("Licensing vector verification failed.");

string token = Text(lease, "token");
string[] parts = token.Split('.');
string tamperedPayload = parts[1][..^1] + (parts[1][^1] == 'A' ? 'B' : 'A');
string wrongAlgHeader = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{{\"alg\":\"none\",\"kid\":\"{pin.Kid}\",\"typ\":\"sm-lease+jwt\"}}"))
    .TrimEnd('=').Replace('+', '-').Replace('/', '_');
long iat = lease.GetProperty("claims").GetProperty("iat").GetInt64();
bool[] rejected =
[
    verifier.VerifyLease($"{parts[0]}.{tamperedPayload}.{parts[2]}", identity, now) is null,
    verifier.VerifyLease($"{wrongAlgHeader}.{parts[1]}.{parts[2]}", identity, now) is null,
    verifier.VerifyLease(token, identity with { Iss = "https://other.example.com" }, now) is null,
    verifier.VerifyLease(token, identity with { Aud = "other-product" }, now) is null,
    verifier.VerifyLease(token, identity, iat - 1) is null,
    new SoftMarketVerifier([pin], new HashSet<string> { pin.Kid }).VerifyLease(token, identity, now) is null,
    new SoftMarketVerifier([pin with { Kid = "unknown-kid" }]).VerifyLease(token, identity, now) is null,
];
if (rejected.Contains(false)) throw new InvalidOperationException("A negative licensing vector was accepted.");

Console.WriteLine("Lease and response vectors passed.");

static string Text(JsonElement element, string name) => element.GetProperty(name).GetString()!;
