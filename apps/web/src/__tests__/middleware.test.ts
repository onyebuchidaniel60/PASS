import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "@/middleware";

/**
 * Marketing/application split at `/`.
 *
 * Logged-out traffic must receive the marketing page. A visitor carrying the
 * PASS session cookie is sent to the application home so an OAuth return or a
 * saved `/` bookmark cannot strand a signed-in user on marketing.
 */
describe("root marketing redirect", () => {
  it("serves / to a visitor with no session cookie", () => {
    const response = middleware(new NextRequest("https://pass.example/"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends a visitor with a PASS session cookie to /app", () => {
    const request = new NextRequest("https://pass.example/");
    request.cookies.set("pass_session", "session-id");
    const response = middleware(request);
    expect(response.headers.get("location")).toBe("https://pass.example/app");
  });
});
