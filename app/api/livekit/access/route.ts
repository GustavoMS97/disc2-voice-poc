import { checkEmailAccess } from "@/app/lib/email-allowlist";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Expected a JSON body." }, { status: 400 }); }
  const email = typeof body === "object" && body !== null && "email" in body ? body.email : undefined;
  const denied = checkEmailAccess(email);
  return Response.json(denied ? { error: denied.error } : { allowed: true }, {
    status: denied?.status ?? 200,
    headers: { "Cache-Control": "no-store" },
  });
}
