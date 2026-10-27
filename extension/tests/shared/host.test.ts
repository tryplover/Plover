import { describe, expect, it } from "vitest";
import { hostMatchesDomain, httpHostname } from "@/shared/host";

describe("httpHostname", () => {
  it("lowercases http(s) hosts", () => {
    expect(httpHostname("https://News.Example.com/x")).toBe("news.example.com");
    expect(httpHostname("http://a.com")).toBe("a.com");
  });
  it("rejects other protocols and garbage", () => {
    expect(httpHostname("chrome://settings")).toBeNull();
    expect(httpHostname("not a url")).toBeNull();
  });
});

describe("hostMatchesDomain", () => {
  it("matches the domain and its subdomains only", () => {
    expect(hostMatchesDomain("a.com", "a.com")).toBe(true);
    expect(hostMatchesDomain("m.a.com", "a.com")).toBe(true);
    expect(hostMatchesDomain("nota.com", "a.com")).toBe(false);
  });
});
