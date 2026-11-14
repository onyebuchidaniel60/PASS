"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  ApiKeyCreatedDto,
  ApiKeyListDto,
  ApiKeyRevokedDto,
  ApiKeySummaryDto,
} from "@pass/contracts";

import { clientDelete, clientGet, clientPost } from "@/lib/client";
import { Inline, Panel, Stack } from "@/components/wave1/layout";
import { Field, TextInput } from "@/components/wave2/controls";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/wave3/data";

/**
 * Agent Access (NEAR Hackathon AGT track).
 *
 * Real API keys, not a browser preview. The plaintext key exists only in the
 * creation response: it is shown once, can be copied, and is never fetched
 * again. The list below shows only the non-secret prefix.
 */

type LoadState = "loading" | "ready" | "error";

const defaultLoadKeys = () =>
  clientGet<ApiKeyListDto>("/api/v1/agent/keys");

const defaultCreateKey = (name: string) =>
  clientPost<ApiKeyCreatedDto>("/api/v1/agent/keys", { name });

const defaultRevokeKey = (id: string) =>
  clientDelete<ApiKeyRevokedDto>(`/api/v1/agent/keys/${id}`);

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export interface AgentAccessProps {
  /** Injectable for tests; production uses the same-origin API. */
  loadKeys?: () => Promise<ApiKeyListDto>;
  createKey?: (name: string) => Promise<ApiKeyCreatedDto>;
  revokeKey?: (id: string) => Promise<ApiKeyRevokedDto>;
}

export function AgentAccess({
  loadKeys = defaultLoadKeys,
  createKey = defaultCreateKey,
  revokeKey = defaultRevokeKey,
}: AgentAccessProps) {
  const [keys, setKeys] = useState<ApiKeySummaryDto[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<ApiKeyCreatedDto | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    setLoadState("loading");
    setLoadError("");
    loadKeys()
      .then((data) => {
        if (!live) return;
        setKeys(data.keys);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        if (!live) return;
        setLoadError(errorMessage(err, "Could not load API keys."));
        setLoadState("error");
      });
    return () => {
      live = false;
    };
  }, [loadKeys, reloadToken]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Enter a name for this key.");
      return;
    }
    setCreating(true);
    setFormError("");
    setNotice("");
    try {
      const result = await createKey(trimmed);
      const summary: ApiKeySummaryDto = {
        id: result.id,
        name: result.name,
        prefix: result.prefix,
        createdAt: result.createdAt,
        lastUsedAt: result.lastUsedAt,
      };
      setCreated(result);
      setKeys((current) => [summary, ...current]);
      setName("");
      setCopied(false);
    } catch (err: unknown) {
      setFormError(errorMessage(err, "Could not generate the key."));
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setNotice("Copy failed. Select the key text and copy it manually.");
    }
  };

  const revoke = async (key: ApiKeySummaryDto) => {
    setRevoking(key.id);
    setNotice("");
    try {
      await revokeKey(key.id);
      setKeys((current) => current.filter((row) => row.id !== key.id));
      if (created?.id === key.id) setCreated(null);
      setNotice(`${key.name} revoked. It can no longer authenticate.`);
    } catch (err: unknown) {
      setNotice(errorMessage(err, "Could not revoke the key."));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <Panel className="pass-agent-access">
      <Stack gap="5">
        <Stack gap="2">
          <h2 style={{ fontSize: "var(--type-title-s-size)" }}>Agent Access</h2>
          <p className="pass-note">
            Build a trading bot against the same Passes humans use. API keys
            authenticate the Agent endpoints; they cannot withdraw, transfer, or
            change account settings.
          </p>
        </Stack>

        <div className="pass-agent-key-box">
          <Stack gap="4">
            <div>
              <span className="pass-settings-kicker">Create a key</span>
              <h3 className="pass-agent-key-title">New Agent API key</h3>
              <p className="pass-note">
                Name the bot or environment this key belongs to. The key is shown
                once and cannot be recovered later.
              </p>
            </div>

            <form
              className="pass-agent-key-form"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <Field
                label="Key name"
                required
                helper="For example: Python Bot, Trading Desk, CI."
                error={formError || undefined}
              >
                {({ controlId, describedBy }) => (
                  <TextInput
                    id={controlId}
                    value={name}
                    onChange={setName}
                    describedBy={describedBy}
                    invalid={Boolean(formError)}
                    placeholder="Python Bot"
                    disabled={creating}
                  />
                )}
              </Field>
              <button
                type="submit"
                className="pass-btn pass-agent-generate"
                data-variant="primary"
                disabled={creating}
              >
                {creating ? "Generating…" : "Generate Key"}
              </button>
            </form>

            {created ? (
              <div className="pass-agent-secret" role="alert">
                <Stack gap="3">
                  <strong>Copy this key now. You won&apos;t be able to see it again.</strong>
                  <code className="pass-agent-key" data-testid="agent-api-key">
                    {created.key}
                  </code>
                  <Inline gap="3">
                    <button
                      type="button"
                      className="pass-btn"
                      data-variant="secondary"
                      onClick={copy}
                    >
                      {copied ? "Copied" : "Copy key"}
                    </button>
                    <button
                      type="button"
                      className="pass-btn"
                      data-variant="ghost"
                      onClick={() => setCreated(null)}
                    >
                      Dismiss
                    </button>
                  </Inline>
                </Stack>
              </div>
            ) : null}

            {notice ? (
              <p className="pass-note" role="status">
                {notice}
              </p>
            ) : null}
          </Stack>
        </div>

        <Stack gap="3">
          <div className="pass-agent-key-list-head">
            <div>
              <span className="pass-settings-kicker">Active keys</span>
              <h3 className="pass-agent-key-title">Your keys</h3>
            </div>
            <span className="pass-agent-key-count">
              {keys.length} active
            </span>
          </div>

          {loadState === "loading" ? (
            <LoadingBlock label="Loading API keys" rows={2} />
          ) : loadState === "error" ? (
            <ErrorBlock
              detail={loadError}
              onRetry={() => setReloadToken((value) => value + 1)}
            />
          ) : keys.length === 0 ? (
            <EmptyBlock title="No API keys yet">
              Generate a key above when you are ready to connect a bot.
            </EmptyBlock>
          ) : (
            <ul className="pass-agent-key-list">
              {keys.map((key) => (
                <li className="pass-agent-key-row" key={key.id}>
                  <div className="pass-agent-key-row-main">
                    <strong>{key.name}</strong>
                    <code className="pass-agent-key-prefix">
                      {key.prefix}…
                    </code>
                    <span className="pass-stale">
                      Created {formatDate(key.createdAt)}
                      {key.lastUsedAt
                        ? ` · Last used ${formatDate(key.lastUsedAt)}`
                        : " · Never used"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pass-btn"
                    data-variant="destructive"
                    disabled={revoking === key.id}
                    onClick={() => void revoke(key)}
                  >
                    {revoking === key.id ? "Revoking…" : "Revoke"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Stack>

        <Stack gap="3" className="pass-agent-quickstart">
          <div>
            <span className="pass-settings-kicker">Quick start</span>
            <h3 className="pass-agent-key-title">Use the key</h3>
            <p className="pass-note">
              Send it as <code>Authorization: Bearer pass_agt_…</code> on every
              Agent request. Keep it out of URLs, logs, and screenshots.
            </p>
            <p className="pass-note">
              Discovery and execution examples live in the full developer
              documentation.
            </p>
          </div>
          <Link href="/developers" className="pass-btn" data-variant="secondary">
            View Full Developer Documentation <span aria-hidden="true">→</span>
          </Link>
        </Stack>
      </Stack>
    </Panel>
  );
}
