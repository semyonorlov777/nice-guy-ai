"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { MobileTabs } from "@/components/MobileTabs";
import { ChatListProvider } from "@/contexts/ChatListContext";
import type { ChatItemData } from "@/components/ChatListItem";

const SLUG = "nice-guy";

interface SidebarData {
  programId: string;
  features: Record<string, boolean> | null;
  user: { name: string; username: string | null; avatarUrl: string | null } | null;
  initialChats: ChatItemData[];
  exerciseCount: number;
}

export default function TestIsspLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarData, setSidebarData] = useState<SidebarData | null>(null);
  const fetchedRef = useRef(false);

  // Auth detection: check on mount + listen for changes
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (active && user) setIsAuthenticated(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        setIsAuthenticated(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch sidebar data when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    async function fetchSidebarData() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: program } = await supabase
          .from("programs")
          .select("id, features")
          .eq("slug", SLUG)
          .single();
        if (!program) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("name, telegram_username, avatar_url")
          .eq("id", user.id)
          .single();

        const { count: exerciseCount } = await supabase
          .from("exercises")
          .select("id", { count: "exact", head: true })
          .eq("program_id", program.id);

        const { data: chatsData } = await supabase
          .from("chats")
          .select(
            "id, title, chat_type, exercise_id, status, last_message_at"
          )
          .eq("user_id", user.id)
          .eq("program_id", program.id)
          .in("status", ["active", "completed"])
          .order("last_message_at", { ascending: false })
          .limit(30);

        // Chat previews
        const chatIds = (chatsData || []).map((c) => c.id);
        const previews = new Map<string, string>();
        if (chatIds.length > 0) {
          const { data: lastMessages } = await supabase
            .from("messages")
            .select("chat_id, content")
            .in("chat_id", chatIds)
            .eq("role", "assistant")
            .order("created_at", { ascending: false });
          if (lastMessages) {
            for (const msg of lastMessages) {
              if (!previews.has(msg.chat_id)) {
                previews.set(msg.chat_id, msg.content.slice(0, 80));
              }
            }
          }
        }

        // Exercise numbers for exercise chats
        const exerciseIds = [
          ...new Set(
            (chatsData || [])
              .filter((c) => c.exercise_id)
              .map((c) => c.exercise_id as string)
          ),
        ];
        const exerciseMap = new Map<string, number>();
        if (exerciseIds.length > 0) {
          const { data: exercises } = await supabase
            .from("exercises")
            .select("id, number")
            .in("id", exerciseIds);
          if (exercises) {
            for (const ex of exercises) {
              exerciseMap.set(ex.id, ex.number);
            }
          }
        }

        if (cancelled) return;

        const initialChats: ChatItemData[] = (chatsData || []).map((c) => ({
          id: c.id,
          title: c.title || "Новый чат",
          chatType: c.chat_type,
          exerciseNumber: c.exercise_id
            ? exerciseMap.get(c.exercise_id) || null
            : null,
          preview: previews.get(c.id) || "",
          lastMessageAt: c.last_message_at,
        }));

        setSidebarData({
          programId: program.id,
          features: program.features as Record<string, boolean> | null,
          user: profile
            ? {
                name: profile.name || "",
                username: profile.telegram_username || null,
                avatarUrl: profile.avatar_url || null,
              }
            : null,
          initialChats,
          exerciseCount: exerciseCount || 0,
        });
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("[TestLayout] fetchSidebarData error", err);
        }
      }
    }

    fetchSidebarData();
    return () => {
      cancelled = true;
      fetchedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <ChatListProvider>
      <div className={isAuthenticated ? "program-layout" : ""}>
        {isAuthenticated && sidebarData && (
          <Sidebar
            slug={SLUG}
            programId={sidebarData.programId}
            user={sidebarData.user}
            features={sidebarData.features}
            initialChats={sidebarData.initialChats}
            exerciseCount={sidebarData.exerciseCount}
          />
        )}
        <main className={isAuthenticated ? "program-main" : ""}>
          {children}
        </main>
        {isAuthenticated && (
          <MobileTabs slug={SLUG} features={sidebarData?.features ?? null} />
        )}
      </div>
    </ChatListProvider>
  );
}
