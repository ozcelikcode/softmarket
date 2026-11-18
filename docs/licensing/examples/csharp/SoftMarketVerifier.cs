using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SoftMarket.Licensing;

public sealed record Pin(string Kid, string PublicKey, DateTimeOffset? RetiredAt = null, bool Revoked = false);
public sealed record Identity(string Iss, string Aud, string Sub, string? Lid, string Fp, string Dkt);

public sealed class SoftMarketVerifier(IReadOnlyList<Pin> pins, IReadOnlySet<string>? revokedKids = null)
{
    private const long MaxUnixTime = 253402300799;
    private const int Day = 86400;
    private const int MaxRefresh = 168 * 3600;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly BigInteger Prime = (BigInteger.One << 255) - 19;
    private static readonly HashSet<BigInteger> SmallOrderY =
    [
        BigInteger.Zero, BigInteger.One, Prime - 1,
        BigInteger.Parse("2707385501144840649318225287225658788936804267575313519463743609750303402022", CultureInfo.InvariantCulture),
        BigInteger.Parse("55188659117513257062467267217118295137698188065244968500265048394206261417927", CultureInfo.InvariantCulture)
    ];

    private static bool Match(string? text, string pattern) =>
        text is not null && Regex.IsMatch(text, @"\A(?:" + pattern + @")\z", RegexOptions.CultureInvariant);

    private static string Encode(byte[] value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[]? Decode(string? value, int? size = null)
    {
        if (value is null || !Match(value, "[A-Za-z0-9_-]+") || value.Length % 4 == 1) return null;
        string padded = value.Replace('-', '+').Replace('_', '/').PadRight((value.Length + 3) / 4 * 4, '=');
        byte[] bytes = Convert.FromBase64String(padded);
        return (size is null || bytes.Length == size) && Encode(bytes) == value ? bytes : null;
    }

    public static string Thumbprint(byte[] rawPublicKey)
    {
        if (rawPublicKey.Length != 32) throw new ArgumentException("Expected a raw 32-byte public key.");
        return Encode(SHA256.HashData(rawPublicKey));
    }

    private (Pin Pin, byte[] Bytes)? Lookup(string? kid, long now)
    {
        if (now < 0 || now > MaxUnixTime || kid is null || !Match(kid, "[A-Za-z0-9_-]{1,64}")
            || revokedKids?.Contains(kid) == true) return null;
        var matches = pins.Where(pin => pin.Kid == kid).Take(2).ToArray();
        if (matches.Length != 1) return null;
        var pin = matches[0];
        var key = Decode(pin.PublicKey, 32);
        if (key is null || Thumbprint(key) != kid || pin.Revoked
            || (pin.RetiredAt is { } retired && now * 1000 >= retired.ToUnixTimeMilliseconds() + 90L * Day * 1000))
            return null;
        var y = new BigInteger(key, isUnsigned: true, isBigEndian: false) & ((BigInteger.One << 255) - 1);
        return y >= Prime || SmallOrderY.Contains(y) ? null : (pin, key);
    }

    public bool VerifyResponse(int status, string nonce, string? keyId, string? signature, byte[] body, long now)
    {
        if (status is < 100 or > 599 || Decode(nonce, 16) is null) return false;
        var pin = Lookup(keyId, now);
        byte[]? sig = Decode(signature, 64);
        if (pin is null || sig is null) return false;
        string hash = Convert.ToHexString(SHA256.HashData(body)).ToLowerInvariant();
        string canonical = $"SM1-RES\n{status.ToString(CultureInfo.InvariantCulture)}\n{nonce}\n{hash}";
        return Ed25519.Verify(pin.Value.Bytes, Utf8.GetBytes(canonical), sig);
    }

    private static Dictionary<string, JsonElement> Fields(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object) throw new JsonException("Expected a JSON object.");
        var fields = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var item in element.EnumerateObject())
            if (!fields.TryAdd(item.Name, item.Value)) throw new JsonException("Duplicate property.");
        return fields;
    }

    // Only omit Lid on first enrollment, after checking the signed activation response.
    public JsonElement? VerifyLease(string token, Identity expected, long now)
    {
        if (token.Length > 4096 || now < 0 || now > MaxUnixTime) return null;
        string[] parts = token.Split('.');
        if (parts.Length != 3) return null;
        byte[]? header = Decode(parts[0]), payload = Decode(parts[1]), signature = Decode(parts[2], 64);
        if (header is null || payload is null || signature is null) return null;
        try
        {
            using var headerJson = ParseCompactObject(header);
            var h = Fields(headerJson.RootElement);
            if (h.Count != 3 || h["alg"].GetString() != "EdDSA" || h["typ"].GetString() != "sm-lease+jwt")
                return null;
            var pin = Lookup(h["kid"].GetString(), now);
            byte[] input = Encoding.ASCII.GetBytes(parts[0] + "." + parts[1]);
            if (pin is null || !Ed25519.Verify(pin.Value.Bytes, input, signature)) return null;

            using var payloadJson = ParseCompactObject(payload);
            var c = Fields(payloadJson.RootElement);
            if (c.Count != 16 || c["v"].GetInt64() != 1 || c["st"].GetString() != "active") return null;
            string? iss = c["iss"].GetString(), aud = c["aud"].GetString(), sub = c["sub"].GetString();
            string? lid = c["lid"].GetString(), fp = c["fp"].GetString(), dkt = c["dkt"].GetString();
            if (iss != expected.Iss || !Uri.TryCreate(iss, UriKind.Absolute, out var issuer)
                || issuer.Scheme != "https" || !string.IsNullOrEmpty(issuer.UserInfo)
                || issuer.GetLeftPart(UriPartial.Authority) != iss
                || aud != expected.Aud || !Match(aud, "[a-z0-9][a-z0-9-]{2,40}")
                || sub != expected.Sub || !Match(sub, "act_[0-9a-f]{24}")
                || (expected.Lid is not null && lid != expected.Lid) || !Match(lid, "lic_[0-9a-f]{24}")
                || fp != expected.Fp || Decode(fp, 32) is null
                || dkt != expected.Dkt || Decode(dkt, 32) is null
                || Decode(c["ctr"].GetString(), 16) is null || string.IsNullOrEmpty(c["sku"].GetString())
                || c["seats"].GetInt64() is < 1 or > 9007199254740991) return null;

            long iat = UnixTime(c["iat"]), nbf = UnixTime(c["nbf"]), exp = UnixTime(c["exp"]), rfa = UnixTime(c["rfa"]);
            long refresh = rfa - iat;
            if (nbf != iat || exp <= iat || exp - iat > 30 * Day || now < nbf || now >= exp
                || refresh is < 3600 or > MaxRefresh || refresh % 3600 != 0
                || (pin.Value.Pin.RetiredAt is { } retired && iat * 1000 > retired.ToUnixTimeMilliseconds()))
                return null;

            string? lexp = c["lexp"].GetString();
            if (lexp is not null &&
                (!Match(lexp, @"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})")
                 || !DateTimeOffset.TryParse(lexp, CultureInfo.InvariantCulture, DateTimeStyles.None, out var end)
                 || exp > end.ToUnixTimeSeconds())) return null;
            return payloadJson.RootElement.Clone();
        }
        catch (Exception ex) when (ex is JsonException or FormatException or DecoderFallbackException
                                  or InvalidOperationException or KeyNotFoundException)
        {
            return null;
        }
    }

    private static JsonDocument ParseCompactObject(byte[] bytes)
    {
        // Validate UTF-8 and reject formatting whitespace outside JSON strings.
        string text = Utf8.GetString(bytes);
        bool quoted = false, escaped = false;
        foreach (char ch in text)
        {
            if (escaped) { escaped = false; continue; }
            if (quoted && ch == '\\') { escaped = true; continue; }
            if (ch == '"') quoted = !quoted;
            if (!quoted && ch is (' ' or '\t' or '\r' or '\n')) throw new JsonException("Expected compact JSON.");
        }
        return JsonDocument.Parse(text);
    }

    private static long UnixTime(JsonElement value)
    {
        long seconds = value.GetInt64();
        if (seconds < 0 || seconds > MaxUnixTime) throw new FormatException("Invalid Unix seconds.");
        return seconds;
    }
}

// Linux reference backend using the system OpenSSL 3. Ed25519 takes the original message.
internal static class Ed25519
{
    private const string Crypto = "libcrypto.so.3";

    internal static bool Verify(byte[] keyBytes, byte[] message, byte[] signature)
    {
        nint key = EVP_PKEY_new_raw_public_key_ex(0, "ED25519", 0, keyBytes, (nuint)keyBytes.Length);
        if (key == 0) return false;
        nint context = 0;
        try
        {
            context = EVP_MD_CTX_new();
            return context != 0 && EVP_DigestVerifyInit(context, 0, 0, 0, key) == 1
                && EVP_DigestVerify(context, signature, (nuint)signature.Length, message, (nuint)message.Length) == 1;
        }
        finally
        {
            if (context != 0) EVP_MD_CTX_free(context);
            EVP_PKEY_free(key);
        }
    }

    [DllImport(Crypto, CallingConvention = CallingConvention.Cdecl)]
    private static extern nint EVP_PKEY_new_raw_public_key_ex(nint libctx, string type, nint properties, byte[] key, nuint keyLength);
    [DllImport(Crypto, CallingConvention = CallingConvention.Cdecl)]
    private static extern void EVP_PKEY_free(nint key);
    [DllImport(Crypto, CallingConvention = CallingConvention.Cdecl)]
    private static extern nint EVP_MD_CTX_new();
    [DllImport(Crypto, CallingConvention = CallingConvention.Cdecl)]
    private static extern void EVP_MD_CTX_free(nint context);
    [DllImport(Crypto, CallingConvention = CallingConvention.Cdecl)]
    private static extern int EVP_DigestVerifyInit(nint context, nint pkeyContext, nint digest, nint engine, nint key);
    [DllImport(Crypto, CallingConvention = CallingConvention.Cdecl)]
    private static extern int EVP_DigestVerify(nint context, byte[] signature, nuint signatureLength, byte[] message, nuint messageLength);
}
