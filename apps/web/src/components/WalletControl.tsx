"use client";

/**
 * The topbar wallet slot — DESIGN.md §8.4, §14.5, §14.6, §14.9.
 *
 * WHY THIS COMPONENT EXISTS
 *
 * It previously was `ConnectWalletEntry` in `ApproveAgentControl.tsx`, which was
 * three lines:
 *
 *     const { isConnected } = useAccount();
 *     if (isConnected) return null;
 *     return <ConnectKitButton />;
 *
 * That `return null` was a shipped bug. The moment a wallet connected the entire
 * slot rendered nothing, so the topbar silently lost its right-hand region and
 * the user had no visible way to know they were connected, let alone to
 * disconnect. `<ConnectKitButton />` was also rendered unconfigured, so the
 * connected state was entirely ConnectKit's own dropdown, styled by ConnectKit's
 * Tailwind classes — a third-party widget in the middle of a product that has
 * its own type scale, its own tokens and its own button.
 *
 * HOW THE SPLIT IS DRAWN NOW
 *
 * ConnectKit does two jobs for us: it owns wallet DISCOVERY and the connect
 * modal, and it renders a button. We want the first and not the second, so this
 * component uses `<ConnectKitButton.Custom>`, whose only render prop we consume
 * is `show()` — the function that opens the modal. Every pixel of every state is
 * then PASS's own `Button` primitive on our own tokens.
 *
 * The alternative — rendering `<ConnectKitButton />` and overriding its Tailwind
 * classes — was rejected: it needs `!important` against a third party's
 * specificity, it breaks on their next release, and it keeps Tailwind in the
 * build for one button. `.Custom` is the documented escape hatch and it is typed.
 *
 * The four states, all testable:
 *
 *   disconnected — PASS's primary button, opening ConnectKit's modal
 *   connecting  — the same button, disabled, at the same visual weight
 *   connected   — the truncated address in the data face, plus a menu
 *   wrong chain — a muted notice plus Disconnect, because PASS cannot fix it
 *
 * §14.15 rule 3: the address truncates, it never wraps, and the slot never grows
 * wide enough to push the navigation. A long unbroken address in an `auto` grid
 * track is precisely what makes a topbar's right-hand region drift to the middle.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectKitButton } from "connectkit";

import { Button } from "@/components/wave2/controls";
import { truncateAddress } from "@/lib/format";
import { hyperliquidChain } from "@/lib/hyperliquid";

/** The chain PASS signs `approveAgent` against (docs/DECISIONS.md D-019.1). */
const EXPECTED_CHAIN = hyperliquidChain.id;

export interface WalletControlProps {
  /** Rendered under the launcher when disconnected. Off for the topbar: it is
   *  onboarding copy, and in the topbar it sized the actions grid track to
   *  max-content, which is what pushed the control toward the middle. */
  showNote?: boolean;
  /**
   * Whether a PASS trading account is linked for this user. The single-state
   * rule (lib/me.ts): an address with no linked account behind it is not a
   * connected account, so the launcher renders even when the browser wallet
   * holds a session. Defaults true so the topbar — which shows the browser
   * wallet itself — keeps its verified behavior.
   */
  linked?: boolean;
}

export function WalletControl({ showNote = false, linked = true }: WalletControlProps) {
  const { address, isConnected, isConnecting, isReconnecting, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const busy = isConnecting || isReconnecting;

  // Close on Escape and on a click outside. A menu that only closes on its own
  // trigger is a keyboard trap.
  useEffect(() => {
    if (!open) return;

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    const onPointer = (ev: PointerEvent) => {
      const node = menuRef.current;
      if (node && ev.target instanceof Node && !node.contains(ev.target)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // `||` on the address, not `&&`. `isConnected` true with no address is a real
  // window in wagmi's lifecycle, and letting it fall through would call
  // `truncateAddress(undefined)` and crash the whole shell rather than showing a
  // launcher. The address is the only thing the chip actually needs.
  // `!linked` forces the launcher: a connected browser wallet with no PASS
  // account is not a connected account, so no address may display.
  if (busy || !isConnected || !address || !linked) {
    return (
      <span className="pass-wallet" data-state={busy ? "connecting" : "disconnected"}>
        {/* §2.5: the accent is rationed to ONE thing per viewport, so the primary
            button is shown only when there is no wallet. The connecting state
            reuses the same variant at the same weight, so nothing jumps when the
            state changes — a spinner or a weight change would both be worse. */}
        <ConnectKitButton.Custom>
          {({ show }) => (
            <Button
              variant="primary"
              size="md"
              disabled={busy}
              onClick={show}
              className="pass-wallet-connect"
            >
              {/* Same reasoning as the X button: "Connect wallet" is the widest
                  label in the actions track. `.pass-wallet-connect-label`
                  shortens it below the mobile breakpoint so both topbar controls fit at 375
                  without wrapping.

                  ONE span, not two. The earlier version paired an aria-hidden
                  visible label with a visually-hidden copy of the same words,
                  which made the button's text content "Connect walletConnect
                  wallet" and broke the assertion that the launcher says what it
                  says. The CSS shortens this span via `::after`; the span
                  itself still contains the full words, so both the accessible
                  name and the text content are unchanged. */}
              <span className="pass-wallet-connect-label">
                {busy ? "Connecting…" : "Connect wallet"}
              </span>
            </Button>
          )}
        </ConnectKitButton.Custom>
        {showNote && !busy ? (
          <span className="pass-note">
            Connecting a wallet lets PASS request your signature to approve an agent
            wallet. PASS never receives a private key.
          </span>
        ) : null}
      </span>
    );
  }

  const wrongChain = typeof chainId === "number" && chainId !== EXPECTED_CHAIN;
  const short = truncateAddress(address);

  return (
    <span className="pass-wallet" data-state={wrongChain ? "wrong-chain" : "connected"}>
      <div className="pass-wallet-menu" ref={menuRef}>
        <button
          type="button"
          className="pass-wallet-chip"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          {/* The address is DATA (§11.6), so it is mono and the chip is a §14.9
              chip. The hidden label carries BOTH the word and the address, so
              the button is announced "Wallet address 0x12…5678" rather than a
              bare hex string, or worse, just "Wallet address". */}
          <span className="visually-hidden">{`Wallet address ${short}`}</span>
          <span aria-hidden="true" className="pass-wallet-address">
            {short}
          </span>
        </button>

        {open ? (
          <div className="pass-wallet-dropdown" role="menu" aria-label="Wallet">
            <p className="pass-wallet-dropdown-note">
              {wrongChain ? (
                <>
                  Unsupported network. PASS signs on chain {EXPECTED_CHAIN} and this
                  wallet reports {chainId}.
                </>
              ) : (
                <>
                  Connected as <span className="pass-wallet-address">{short}</span>
                </>
              )}
            </p>

            <Link className="pass-wallet-item" href="/settings" role="menuitem">
              View profile
            </Link>

            <button
              type="button"
              className="pass-wallet-item pass-wallet-item-danger"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                disconnect();
              }}
            >
              Disconnect
            </button>
          </div>
        ) : null}
      </div>
    </span>
  );
}
