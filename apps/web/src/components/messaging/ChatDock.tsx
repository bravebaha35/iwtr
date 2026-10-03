"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ConversationSummary, ConversationThread } from "@iwtr/shared-types";
import { apiGet, apiPost } from "@/lib/api-client";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { ConversationThreadView } from "./ConversationThreadView";
import { ConversationStatus, CounterpartPicture } from "./conversationIdentity";

// The private-messages dock, docked to the bottom right of IWT Social only
// (it's rendered by app/social/page.tsx, so it simply doesn't exist on any
// other page). The "Messages" tab sits at the far right; each conversation
// opened from it gets its own panel to the left, newest nearest the tab.
//
// Same endpoints and the same thread component as before - only the layout
// moved here from the old /messages page. Nothing is kept in browser
// storage: open panels live in memory and every panel fetches its
// conversation from the API when it opens. A notification link arrives as
// /social?openChat=<conversationId>; the dock opens that panel and removes
// the parameter from the address bar.

type Mode = "reviewer" | "company";

// Snappy "magnetic" slide up for a panel opening, and back down on close.
const PANEL_EASE = [0.16, 1, 0.3, 1] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DockState {
  activeChats: string[];
  openChat: (conversationId: string) => void;
  closeChat: (conversationId: string) => void;
}

const DockContext = createContext<DockState | null>(null);

/** Open / close dock panels from anywhere inside the dock. */
export function useChatDock(): DockState {
  const state = useContext(DockContext);
  if (!state) throw new Error("useChatDock must be used inside ChatDock");
  return state;
}

/** How many conversation panels fit beside the Messages tab at this window width. */
function maxPanelsFor(width: number): number {
  if (width >= 1440) return 3;
  if (width >= 1100) return 2;
  return 1;
}

function useMaxPanels(): number {
  const [max, setMax] = useState(3);
  useEffect(() => {
    const update = () => setMax(maxPanelsFor(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return max;
}

export function ChatDock() {
  // useSearchParams (the ?openChat= link) needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <DockInner />
    </Suspense>
  );
}

function DockInner() {
  const mode: Mode = useIsCompanyOwner() ? "company" : "reviewer";
  const listPath = mode === "company" ? "/owner/conversations" : "/me/conversations";
  const maxPanels = useMaxPanels();
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [listError, setListError] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [activeChats, setActiveChats] = useState<string[]>([]);
  const openChatParam = useSearchParams().get("openChat");

  const loadList = useCallback(() => {
    apiGet<ConversationSummary[]>(listPath)
      .then((rows) => {
        setList(rows);
        setListError(false);
      })
      .catch(() => setListError(true));
  }, [listPath]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openChat = useCallback(
    (conversationId: string) => {
      // Newest panel goes next to the Messages tab; past the limit the
      // oldest (leftmost) one closes.
      setActiveChats((prev) => [conversationId, ...prev.filter((id) => id !== conversationId)].slice(0, maxPanels));
    },
    [maxPanels],
  );
  const closeChat = useCallback((conversationId: string) => {
    setActiveChats((prev) => prev.filter((id) => id !== conversationId));
  }, []);

  // Window got narrower: drop the panels that no longer fit.
  useEffect(() => {
    setActiveChats((prev) => (prev.length > maxPanels ? prev.slice(0, maxPanels) : prev));
  }, [maxPanels]);

  // A notification link: open that conversation, then clean the address bar.
  useEffect(() => {
    if (!openChatParam) return;
    if (UUID.test(openChatParam)) openChat(openChatParam);
    const url = new URL(window.location.href);
    url.searchParams.delete("openChat");
    window.history.replaceState(window.history.state, "", url);
  }, [openChatParam, openChat]);

  const onThreadChange = useCallback((updated: ConversationThread) => {
    setList(
      (rows) =>
        rows?.map((r) =>
          r.id === updated.id
            ? {
                ...r,
                ended: updated.ended,
                endedBy: updated.endedBy,
                ownerName: updated.ownerName,
                companyReplied: updated.companyReplied,
                lastMessagePreview: updated.lastMessagePreview,
                lastMessageDay: updated.lastMessageDay,
                unread: false,
              }
            : r,
        ) ?? rows,
    );
  }, []);

  const state = useMemo(() => ({ activeChats, openChat, closeChat }), [activeChats, openChat, closeChat]);
  const unreadCount = list?.filter((r) => r.unread).length ?? 0;

  return (
    <DockContext.Provider value={state}>
      <div
        aria-label="Messages"
        role="region"
        className="pointer-events-none fixed bottom-0 right-4 z-50 flex flex-row-reverse items-end gap-3"
      >
        <MessagesTab
          mode={mode}
          list={list}
          listError={listError}
          open={listOpen}
          // On a phone an open conversation takes the whole width.
          hideOnPhone={activeChats.length > 0}
          unreadCount={unreadCount}
          onToggle={() => {
            if (!listOpen) loadList();
            setListOpen((v) => !v);
          }}
        />
        <AnimatePresence initial={false}>
          {activeChats.map((id) => (
            <ChatPanel
              key={id}
              conversationId={id}
              mode={mode}
              summary={list?.find((r) => r.id === id) ?? null}
              onThreadChange={onThreadChange}
            />
          ))}
        </AnimatePresence>
      </div>
    </DockContext.Provider>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

const TITLE_BAR =
  "flex w-full items-center gap-2 border-b border-border bg-surface-muted px-3 py-2 text-left text-sm text-foreground";
const ICON_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] text-muted-foreground hover:bg-surface hover:text-foreground";

function MessagesTab({
  mode,
  list,
  listError,
  open,
  hideOnPhone,
  unreadCount,
  onToggle,
}: {
  mode: Mode;
  list: ConversationSummary[] | null;
  listError: boolean;
  open: boolean;
  hideOnPhone: boolean;
  unreadCount: number;
  onToggle: () => void;
}) {
  const { openChat, activeChats } = useChatDock();
  return (
    <section
      className={`pointer-events-auto flex w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-t-[2px] border border-b-0 border-border bg-surface ${
        hideOnPhone ? "max-sm:hidden" : ""
      }`}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className={TITLE_BAR}>
        <span className="flex-1 font-medium">Messages</span>
        {unreadCount > 0 && (
          <span className="rounded-[2px] bg-brand-600 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
            {unreadCount}
            <span className="sr-only"> unread</span>
          </span>
        )}
        <ChevronIcon up={!open} />
      </button>
      {open && (
        <div className="max-h-[min(26rem,calc(100dvh-8rem))] overflow-y-auto">
          {listError && <p className="p-3 text-sm text-red-700 dark:text-red-300">Couldn&apos;t load your messages.</p>}
          {!listError && list === null && <p className="p-3 text-sm text-muted-foreground">Loading messages…</p>}
          {list !== null && list.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              {mode === "company"
                ? "No messages yet. When a reviewer you've replied to writes to you, it will show up here."
                : "No messages yet. After a company replies to one of your reviews, you can message it privately from My Ratings."}
            </p>
          )}
          {list !== null && list.length > 0 && (
            <ul aria-label="Conversations" className="divide-y divide-border">
              {list.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => openChat(row.id)}
                    aria-current={activeChats.includes(row.id) ? "true" : undefined}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-muted ${
                      activeChats.includes(row.id) ? "bg-surface-muted" : ""
                    }`}
                  >
                    <CounterpartPicture conversation={row} mode={mode} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-foreground">{row.companyName}</span>
                        {row.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                      </span>
                      <ConversationStatus conversation={row} mode={mode} />
                      <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                        {row.lastMessagePreview}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ChatPanel({
  conversationId,
  mode,
  summary,
  onThreadChange,
}: {
  conversationId: string;
  mode: Mode;
  summary: ConversationSummary | null;
  onThreadChange: (thread: ConversationThread) => void;
}) {
  const { closeChat } = useChatDock();
  const reduceMotion = useReducedMotion();
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [error, setError] = useState(false);
  const [minimised, setMinimised] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<ConversationThread>(`/conversations/${conversationId}`)
      .then((loaded) => {
        if (cancelled) return;
        setThread(loaded);
        // Reading it clears the unread dot and the bell notification.
        void apiPost(`/conversations/${conversationId}/read`, {}).catch(() => undefined);
        onThreadChange(loaded);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, onThreadChange]);

  const onChange = useCallback(
    (updated: ConversationThread) => {
      setThread(updated);
      onThreadChange(updated);
    },
    [onThreadChange],
  );

  const shown = thread ?? summary;
  const title = shown?.companyName ?? "Conversation";

  return (
    <motion.section
      layout={!reduceMotion}
      initial={reduceMotion ? false : { y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.38, ease: PANEL_EASE }}
      aria-label={`Conversation with ${title}`}
      className="pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden max-sm:w-[calc(100vw-2rem)] rounded-t-[2px] border border-b-0 border-border bg-surface"
    >
      <div className={TITLE_BAR}>
        <button
          type="button"
          onClick={() => setMinimised((v) => !v)}
          aria-expanded={!minimised}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {shown && <CounterpartPicture conversation={shown} mode={mode} />}
          <span className="min-w-0">
            <span className="block truncate font-medium">{title}</span>
            {shown && <ConversationStatus conversation={shown} mode={mode} />}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMinimised((v) => !v)}
          aria-label={minimised ? "Expand conversation" : "Minimise conversation"}
          className={ICON_BUTTON}
        >
          <ChevronIcon up={minimised} />
        </button>
        <button type="button" onClick={() => closeChat(conversationId)} aria-label="Close conversation" className={ICON_BUTTON}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {!minimised && (
        <div className="flex h-[min(28rem,calc(100dvh-8rem))] flex-col p-3">
          {error ? (
            <p className="text-sm text-red-700 dark:text-red-300">Couldn&apos;t open that conversation.</p>
          ) : thread ? (
            <ConversationThreadView thread={thread} mode={mode} onChange={onChange} variant="dock" />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
      )}
    </motion.section>
  );
}
