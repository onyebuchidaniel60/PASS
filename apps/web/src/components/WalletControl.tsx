"use client";

/**
 * The topbar wallet slot — DESIGN.md §8.4, §14.5, §14.6.
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
 * That `return null` is the reported bug. The moment a wallet connected the
 * entire slot rendered nothing, so the topbar silently lost its right-hand
 * region and the user had no visible way to know they were connected, let alone
 * to disconnect. `<ConnectKitButton />` was also rendered unconfigured — no
 * `custom` render prop — so even before the `null`, the connected state was
 * entirely ConnectKit's own dropdown, styled by ConnectKit's Tailwind classes,
 * which the product does not control.
 *
 * So the connected state is authored here and does not depend on ConnectKit's
 * rendering at all. `<ConnectKitButton />` is kept for the DISCONNECTED case
 * only, where it is a modal launcher: that is what it is good at, and replacing
 * it would mean reimplementing wallet discovery and the connect modal.
 *
 * The four states the slot can be in, all testable:
 *
 *   disconnected — a Connect wallet launcher
 *   connecting  — the same slot, disabled, saying so
 *   connected   — the truncated address in the data face, plus a menu
 *   wrong chain — a muted notice plus Disconnect, because PASS cannot fix it
 *
 * §14.15 rule 3: the address truncates, it never wraps, and the slot never
 * grows wide enough to push the navigation. That last point matters — a long
 * unbroken address in an `auto` grid track is what makes a topbar's right-hand
 * region drift toward the middle.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectKitButton } from "connectkit";

import { truncateAddress } from "@/lib/format";
import { hyperliquidChain } from "@/lib/hyperliquid";

/** The chain PASS signs `approveAgent` against (docs/DECISIONS.md D-019.1). */
const EXPECTED_CHAIN = hyperliquidChain.id;

export interface WalletControlProps {
  /** Rendered under the launcher when disconnected. Off for the topbar. */
  showNote?: boolean;
}

export function WalletControl({ showNote = false }: WalletControlProps) {
  const { address, isConnected, isConnecting, isReconnecting, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const busy = isConnecting || isReconnecting;

  // Close the menu on Escape, and on a click outside it. A menu that only
  // closes on its own trigger is a keyboard trap.
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

  if (busy) {
    return (
      <span className="pass-wallet" data-state="connecting">
        {/* The word carries the state. A spinner alone would be invisible to a
            screen reader and would be motion for its own sake (§14.13). */}
        <span className="pass-wallet-busy" role="status">
          Connecting…
        </span>
      </span>
    );
  }

  if (!isConnected || !address) {
    return (
      <span className="pass-wallet" data-state="disconnected">
        <ConnectKitButton />
        {showNote ? (
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
          {/* The address is DATA (§11.6: identifiers in the data face). The
              hidden label carries BOTH the word and the address, so the button
              is announced "Wallet address 0x12…5678" rather than a bare hex
              string or, worse, just "Wallet address". */}
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
