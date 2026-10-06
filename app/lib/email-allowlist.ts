export function checkEmailAccess(email: unknown): { error: string; status: number } | null {
  if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { error: "Enter a valid email address.", status: 400 };
  }
  const allowed = (process.env.ALLOWED_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (allowed.length === 0) {
    return { error: "The access allowlist is not configured on the server.", status: 503 };
  }
  if (!allowed.includes(email.trim().toLowerCase())) {
    return { error: "This email is not allowed to join.", status: 403 };
  }
  return null;
}
