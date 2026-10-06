import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { TokenVerifier } from "livekit-server-sdk";

let allowlistModule;
function load(relative) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const instance = new Module(filename);
  instance.filename = filename;
  const require = createRequire(filename);
  instance.require = (name) => name === "@/app/lib/email-allowlist" ? allowlistModule : require(name);
  instance._compile(compiled, filename);
  return instance.exports;
}
allowlistModule = load("../app/lib/email-allowlist.ts");
const access = load("../app/api/livekit/access/route.ts");
const token = load("../app/api/livekit/token/route.ts");
const keys = ["ALLOWED_EMAILS", "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"];
const previous = keys.map((key) => process.env[key]);
const request = (body) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
try {
  process.env.ALLOWED_EMAILS = " Alice@Example.com, bob@example.com , ";
  process.env.LIVEKIT_URL = "wss://test.livekit.cloud";
  process.env.LIVEKIT_API_KEY = "test-key";
  process.env.LIVEKIT_API_SECRET = "test-secret-for-validation-only";
  const allowed = await access.POST(request({ email: " ALICE@example.com " }));
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { allowed: true }, "No allowlist/token exposed by precheck");
  for (const [email, status] of [[undefined, 400], [{}, 400], ["invalid", 400], ["mallory@example.com", 403], ["alice@example.com.attacker.org", 403]]) {
    const response = await token.POST(request({ email, name: "Alice" }));
    assert.equal(response.status, status);
    assert.equal((await response.json()).token, undefined, "Direct token requests cannot bypass email gate");
  }
  const response = await token.POST(request({ name: "Alice", email: " ALICE@example.com " }));
  assert.equal(response.status, 200);
  const data = await response.json();
  const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).verify(data.token);
  assert.equal(claims.name, "Alice");
  assert.equal(claims.video.room, "games-poc");
  assert.deepEqual(claims.video.canPublishSources, ["microphone", "screen_share", "screen_share_audio"]);
  assert.equal(JSON.stringify(claims).includes("example.com"), false);
  process.env.ALLOWED_EMAILS = " , ";
  assert.equal((await token.POST(request({ name: "Alice", email: "alice@example.com" }))).status, 503);
  delete process.env.ALLOWED_EMAILS;
  assert.equal((await access.POST(request({ email: "alice@example.com" }))).status, 503);
  console.log("PASS: exact/case-insensitive allowlist, fail-closed configuration, server-side token enforcement, unchanged media grants, no email in token.");
} finally {
  keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  });
}
