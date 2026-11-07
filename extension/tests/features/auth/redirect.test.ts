import { describe, expect, it } from "vitest";
import { parseAuthRedirect } from "@/features/auth/redirect";

const BASE = "https://abcdef.chromiumapp.org/cb";

describe("parseAuthRedirect", () => {
  it("returns the code from the query string", () => {
    expect(parseAuthRedirect(`${BASE}?code=abc123`)).toEqual({
      code: "abc123",
    });
  });

  it("prefers the code when both a code and an error are present", () => {
    expect(parseAuthRedirect(`${BASE}?code=abc123&error=x`)).toEqual({
      code: "abc123",
    });
  });

  it("returns error_description from the query string", () => {
    expect(
      parseAuthRedirect(
        `${BASE}?error=server_error&error_description=Database+is+down`,
      ),
    ).toEqual({ error: "Database is down" });
  });

  it("returns error_description from the URL fragment", () => {
    expect(
      parseAuthRedirect(
        `${BASE}#error=access_denied&error_description=User+denied+access`,
      ),
    ).toEqual({ error: "User denied access" });
  });

  it("falls back to error when there is no error_description", () => {
    expect(parseAuthRedirect(`${BASE}?error=access_denied`)).toEqual({
      error: "access_denied",
    });
  });

  it("treats an empty error_description as absent", () => {
    expect(
      parseAuthRedirect(`${BASE}?error=access_denied&error_description=`),
    ).toEqual({ error: "access_denied" });
  });

  it("reports cancelled when the flow returned nothing", () => {
    expect(parseAuthRedirect(undefined)).toEqual({ cancelled: true });
  });

  it("reports cancelled when the URL has neither a code nor an error", () => {
    expect(parseAuthRedirect(`${BASE}?state=xyz`)).toEqual({ cancelled: true });
  });
});
