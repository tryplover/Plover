export type AuthRedirect =
  { code: string } | { error: string } | { cancelled: true };

export function parseAuthRedirect(returned: string | undefined): AuthRedirect {
  if (!returned) return { cancelled: true };
  const url = new URL(returned);
  const params = new URLSearchParams(url.search);
  new URLSearchParams(url.hash.slice(1)).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  const code = params.get("code");
  if (code) return { code };
  const error = params.get("error_description") || params.get("error");
  if (error) return { error };
  return { cancelled: true };
}
