"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ConversationSummary, ConversationThread } from "@iwtr/shared-types";
import { apiGet, apiPost } from "@/lib/api-client";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { ConversationThreadView } from "./ConversationThreadView";
import { ConversationStatus, CounterpartPicture } from "./conversationIdentity";
import { useT } from "@/lib/i18n/client";

// The private-messages dock, docked to the bottom right of every page
// except Edit Profile and the Dashboard (GlobalChatDock in layout.tsx
// decides where; a company login gets it on its Dashboard instead). The
// "Messages" tab sits at the far right; each conversation opened from it
// gets its own panel to the left, newest nearest the tab. A panel can be
// minimised to its name, enlarged to a roomy reading size, or closed.
//
// Nothing is kept in browser storage: open panels live in memory and every
// panel fetches its conversation from the API when it opens. A notification
// link arrives as /social?openChat=<conversationId> (the parameter works on
// any page that shows the dock); the dock opens that panel and removes the
// parameter from the address bar.

type Mode = "reviewer" | "company";

// Snappy "magnetic" slide up for a panel opening, and back down on close.
const PANEL_EASE = [0.16, 1, 0.3, 1] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DockState {
  activeChats: string[];
  enlargedChat: string | null;
  openChat: (conversationId: string) => void;
  closeChat: (conversationId: string) => void;
  toggleEnlarged: (conversationId: string) => void;
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
  const [enlargedChat, setEnlargedChat] = useState<string | null>(null);
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

  // An enlarged panel takes about two panels' room, so one fewer fits.
  const limit = enlargedChat ? Math.max(1, maxPanels - 1) : maxPanels;

  const openChat = useCallback(
    (conversationId: string) => {
      // Newest panel goes next to the Messages tab; past the limit the
      // oldest (leftmost) one closes.
      setActiveChats((prev) => [conversationId, ...prev.filter((id) => id !== conversationId)].slice(0, limit));
    },
    [limit],
  );
  const closeChat = useCallback((conversationId: string) => {
    setActiveChats((prev) => prev.filter((id) => id !== conversationId));
    setEnlargedChat((current) => (current === conversationId ? null : current));
  }, []);
  const toggleEnlarged = useCallback(
    (conversationId: string) => {
      if (enlargedChat === conversationId) {
        setEnlargedChat(null);
        return;
      }
      // Make room: keep the enlarged one plus whatever still fits beside it.
      const room = Math.max(1, maxPanels - 1);
      setActiveChats((prev) => [conversationId, ...prev.filter((id) => id !== conversationId)].slice(0, room));
      setEnlargedChat(conversationId);
    },
    [enlargedChat, maxPanels],
  );

  // Window got narrower: drop the panels that no longer fit.
  useEffect(() => {
    setActiveChats((prev) => (prev.length > limit ? prev.slice(0, limit) : prev));
  }, [limit]);

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

  const state = useMemo(
    () => ({ activeChats, enlargedChat, openChat, closeChat, toggleEnlarged }),
    [activeChats, enlargedChat, openChat, closeChat, toggleEnlarged],
  );
  const unreadCount = list?.filter((r) => r.unread).length ?? 0;
  const t = useT();

  return (
    <DockContext.Provider value={state}>
      <div
        aria-label={t("Messages")}
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
              enlarged={enlargedChat === id}
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

function EnlargeIcon({ enlarged }: { enlarged: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {enlarged ? (
        // Arrows pointing in: back to the normal size.
        <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
      ) : (
        // Arrows pointing out: make it bigger.
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      )}
    </svg>
  );
}

// Every panel shares one shape: soft top corners, lifted off the page by a
// shadow instead of an outline, flush with the bottom of the window.
const PANEL_SHELL =
  "pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-t-xl bg-surface shadow-[0_-4px_24px_-6px_rgba(20,30,22,0.22)] ring-1 ring-border/60";
const PANEL_WIDTH = "w-80";
const ENLARGED_WIDTH = "w-[min(40rem,calc(100vw-2rem))]";
const ICON_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600";

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
  const t = useT();
  return (
    <section className={`${PANEL_SHELL} ${PANEL_WIDTH} ${hideOnPhone ? "max-sm:hidden" : ""}`}>
      {/* The Messages tab is the one Wood-filled bar, so it never reads as
          one of the conversation panels beside it. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 bg-brand-600 px-4 py-2.5 text-left text-sm text-white transition hover:bg-brand-700"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 opacity-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
        </svg>
        <span className="flex-1 font-semibold">{t("Messages")}</span>
        {unreadCount > 0 && (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-brand-700">
            {unreadCount}
            <span className="sr-only"> {t("unread")}</span>
          </span>
        )}
        <ChevronIcon up={!open} />
      </button>
      {open && (
        <div className="max-h-[min(28rem,calc(100dvh-8rem))] overflow-y-auto p-1.5">
          {listError && <p className="p-3 text-sm text-red-700 dark:text-red-300">{t("Couldn't load your messages.")}</p>}
          {!listError && list === null && (
            <ul aria-hidden="true" className="flex flex-col gap-1 p-1">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface-muted" />
                  <span className="flex-1 space-y-1.5">
                    <span className="block h-3 w-2/3 animate-pulse rounded bg-surface-muted" />
                    <span className="block h-2.5 w-1/2 animate-pulse rounded bg-surface-muted" />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {list !== null && list.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              {mode === "company"
                ? t("No messages yet. When a reviewer you've replied to writes to you, it will show up here.")
                : t("No messages yet. After a company replies to one of your reviews, you can message it privately from My Ratings.")}
            </p>
          )}
          {list !== null && list.length > 0 && (
            <ul aria-label={t("Conversations")} className="flex flex-col gap-0.5">
              {list.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => openChat(row.id)}
                    aria-current={activeChats.includes(row.id) ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors hover:bg-surface-muted ${
                      activeChats.includes(row.id) ? "bg-surface-muted" : ""
                    }`}
                  >
                    <CounterpartPicture conversation={row} mode={mode} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-foreground ${row.unread ? "font-bold" : "font-medium"}`}>
                          {row.companyName}
                        </span>
                        {row.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label={t("Unread")} />}
                      </span>
                      <ConversationStatus conversation={row} mode={mode} />
                      <span
                        className={`mt-0.5 block truncate text-xs ${row.unread ? "font-medium text-foreground" : "font-normal text-muted-foreground"}`}
                      >
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
  enlarged,
  summary,
  onThreadChange,
}: {
  conversationId: string;
  mode: Mode;
  enlarged: boolean;
  summary: ConversationSummary | null;
  onThreadChange: (thread: ConversationThread) => void;
}) {
  const { closeChat, toggleEnlarged } = useChatDock();
  const reduceMotion = useReducedMotion();
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [error, setError] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const t = useT();

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
  // A minimised panel is a plain name tab: the company for a reviewer, the
  // review's public name for the company. No picture, no status line.
  const minimisedTitle = (mode === "company" ? shown?.reviewerName : shown?.companyName) ?? title;
  const big = enlarged && !minimised;

  return (
    <motion.section
      layout={!reduceMotion}
      initial={reduceMotion ? false : { y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.38, ease: PANEL_EASE }}
      aria-label={`Conversation with ${title}`}
      className={`${PANEL_SHELL} ${big ? ENLARGED_WIDTH : PANEL_WIDTH} max-sm:w-[calc(100vw-2rem)]`}
    >
      <div
        className={`flex w-full items-center gap-1 border-b border-border/70 pl-3 pr-1.5 text-left text-sm text-foreground ${
          minimised ? "py-1" : "py-2"
        }`}
      >
        <button
          type="button"
          onClick={() => setMinimised((v) => !v)}
          aria-expanded={!minimised}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          {minimised ? (
            <span className="block min-w-0 truncate py-1 font-semibold">{minimisedTitle}</span>
          ) : (
            <>
              {shown && <CounterpartPicture conversation={shown} mode={mode} />}
              <span className="min-w-0">
                <span className="block truncate font-semibold">{title}</span>
                {shown && <ConversationStatus conversation={shown} mode={mode} />}
              </span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setMinimised((v) => !v)}
          aria-label={minimised ? t("Expand conversation") : t("Minimise conversation")}
          title={minimised ? t("Expand conversation") : t("Minimise conversation")}
          className={ICON_BUTTON}
        >
          <ChevronIcon up={minimised} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (minimised) setMinimised(false);
            toggleEnlarged(conversationId);
          }}
          aria-label={big ? t("Make conversation smaller") : t("Make conversation bigger")}
          title={big ? t("Make conversation smaller") : t("Make conversation bigger")}
          aria-pressed={big}
          className={`${ICON_BUTTON} max-sm:hidden`}
        >
          <EnlargeIcon enlarged={big} />
        </button>
        <button
          type="button"
          onClick={() => closeChat(conversationId)}
          aria-label={t("Close conversation")}
          title={t("Close conversation")}
          className={ICON_BUTTON}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {!minimised && (
        <div
          className={`flex flex-col ${
            big ? "h-[min(42rem,calc(100dvh-6rem))] px-5 pb-4 pt-3" : "h-[min(30rem,calc(100dvh-8rem))] px-3 pb-3 pt-2"
          }`}
        >
          {error ? (
            <p className="text-sm text-red-700 dark:text-red-300">{t("Couldn't open that conversation.")}</p>
          ) : thread ? (
            <ConversationThreadView thread={thread} mode={mode} onChange={onChange} variant="dock" roomy={big} />
          ) : (
            <div aria-hidden="true" className="flex flex-1 flex-col justify-end gap-2 pb-16">
              <span className="h-8 w-2/3 animate-pulse self-start rounded-2xl bg-surface-muted" />
              <span className="h-8 w-1/2 animate-pulse self-end rounded-2xl bg-surface-muted" />
              <span className="h-8 w-3/5 animate-pulse self-start rounded-2xl bg-surface-muted" />
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}
