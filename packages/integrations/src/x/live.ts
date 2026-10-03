import type { XPostResult, XUser } from "@pass/contracts";
import type { XPort } from "../ports.js";
import { ProviderError, ProviderUnavailableError } from "../ports.js";

/**
 * Live X adapter.
 * Reference: https://docs.x.com/x-api/posts/create-post
 *
 * Native posting is optional. Sharing must remain usable as copy-only when
 * posting is unavailable (docs/API_CONTRACTS.md §5, Stage H gate).
 */
export class LiveX implements XPort {
  readonly mode = "live" as const;

  async resolveIdentity(handle: string): Promise<XUser | null> {
    // Display-only resolution uses the public users-by-username endpoint.
    const clean = encodeURIComponent(handle.replace(/^@/, ""));
    let res: Response;
    try {
      res = await fetch(
        `https://api.x.com/2/users/by/username/${clean}?user.fields=profile_image_url,description`,
        { headers: { Accept: "application/json" } },
      );
    } catch (err) {
      throw new ProviderUnavailableError("x", String(err));
    }
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { id: string; username: string; name?: string; profile_image_url?: string };
    };
    if (!json.data) return null;
    return {
      xUserId: json.data.id,
      handle: json.data.username,
      displayName: json.data.name ?? null,
      avatarUrl: json.data.profile_image_url ?? null,
    };
  }

  async createPost(accessToken: string, text: string): Promise<XPostResult> {
    if (!accessToken) {
      throw new ProviderError("X access token is unavailable", "x", false);
    }
    let res: Response;
    try {
      res = await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      throw new ProviderUnavailableError("x", String(err));
    }
    if (!res.ok) {
      const text2 = await res.text();
      throw new ProviderError(`X post failed ${res.status}: ${text2}`, "x", res.status >= 500);
    }
    const json = (await res.json()) as { data?: { id: string; text: string } };
    const id = json.data?.id ?? "";
    return {
      postId: id,
      text: json.data?.text ?? text,
      url: id ? `https://x.com/i/web/status/${id}` : null,
    };
  }

  buildAuthorizationUrl(opts: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scope: string;
  }): string {
    const p = new URLSearchParams({
      response_type: "code",
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      scope: opts.scope,
      state: opts.state,
      code_challenge: opts.codeChallenge,
      code_challenge_method: "S256",
    });
    return `https://twitter.com/i/oauth2/authorize?${p.toString()}`;
  }
}