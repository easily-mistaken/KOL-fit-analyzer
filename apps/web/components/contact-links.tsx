import { MessageCircle, Send } from "lucide-react";

/**
 * Direct lines to the operator (Unit 44).
 *
 * Configured, not hardcoded: `NEXT_PUBLIC_CONTACT_TELEGRAM` /
 * `NEXT_PUBLIC_CONTACT_X` (with or without a leading `@`). Each link renders
 * only when its handle is set, and the whole block disappears when neither is —
 * so an unconfigured deploy shows nothing rather than a dead link.
 */

const strip = (v: string | undefined): string | null => {
  const h = v?.trim().replace(/^@/, "");
  return h && h.length > 0 ? h : null;
};

export function hasContactLinks(): boolean {
  return Boolean(
    strip(process.env.NEXT_PUBLIC_CONTACT_TELEGRAM) ||
      strip(process.env.NEXT_PUBLIC_CONTACT_X)
  );
}

export function ContactLinks({ className }: { className?: string }) {
  const telegram = strip(process.env.NEXT_PUBLIC_CONTACT_TELEGRAM);
  const x = strip(process.env.NEXT_PUBLIC_CONTACT_X);
  if (!telegram && !x) return null;

  const item =
    "inline-flex items-center gap-1.5 rounded-full border border-default px-3 py-1.5 text-[12.5px] font-medium text-secondary-foreground transition-colors hover:border-strong hover:text-foreground";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {telegram && (
          <a
            className={item}
            href={`https://t.me/${telegram}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send className="h-3.5 w-3.5" />
            Telegram
          </a>
        )}
        {x && (
          <a
            className={item}
            // The profile, not `/messages/compose`: that endpoint only accepts a
            // NUMERIC recipient_id, so a handle-based compose link silently
            // lands on an empty composer. One extra tap beats a broken one.
            href={`https://x.com/${x}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            @{x} on X
          </a>
        )}
      </div>
    </div>
  );
}
