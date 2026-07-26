import type { GroupChatMode } from '@meetingpnt/shared';
import { SocketEvents } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { chatApi } from '../api/chatApi.js';
import { ApiError } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { useAuthStore } from '../store/authStore.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';

interface Props {
  groupId: string;
  chatMode: GroupChatMode;
  isLeader: boolean;
}

export function GroupChatPanel({ groupId, chatMode, isLeader }: Props) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useQuery({
    queryKey: ['groups', groupId, 'messages'],
    queryFn: () => chatApi.list(groupId),
  });
  const messages = messagesQuery.data?.messages ?? [];

  const canPost = isLeader || chatMode === 'two_way';

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.emit('group:join', groupId);

    function onChatMessage() {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'messages'] });
    }

    socket.on(SocketEvents.ChatMessage, onChatMessage);
    return () => {
      socket.off(SocketEvents.ChatMessage, onChatMessage);
      socket.disconnect();
    };
  }, [groupId, queryClient]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !image) return;
    setError(null);
    setSending(true);
    try {
      await chatApi.send(groupId, body.trim() || undefined, image ?? undefined);
      setBody('');
      setImage(null);
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'messages'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">Chat</h2>
      <p className="mt-1 text-sm text-slate-500">
        {chatMode === 'announcements'
          ? 'Announcements only — members can read but not reply.'
          : 'Two-way chat — anyone in the group can post.'}
      </p>

      <Card className="mt-3 p-0">
        <div ref={listRef} className="flex max-h-96 flex-col gap-3 overflow-y-auto p-4">
          {messages.map((message) => (
            <div key={message.id} className={message.authorId === currentUser?.id ? 'self-end text-right' : ''}>
              <p className="text-xs text-slate-400">{message.author.name}</p>
              {message.body && (
                <p className="mt-0.5 inline-block rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
                  {message.body}
                </p>
              )}
              {message.imageUrl && (
                <img
                  src={message.imageUrl}
                  alt="Shared"
                  className="mt-1 max-h-64 rounded-lg border border-slate-200"
                />
              )}
            </div>
          ))}
          {messages.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">No messages yet.</p>
          )}
        </div>

        {canPost ? (
          <form onSubmit={handleSend} className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
            <input
              placeholder="Write a message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-w-[160px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              className="text-xs text-slate-500"
            />
            <Button type="submit" size="sm" disabled={sending}>
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </form>
        ) : (
          <p className="border-t border-slate-100 p-3 text-center text-sm text-slate-400">
            Only the leader can post in this group.
          </p>
        )}
        {error && <p className="px-3 pb-3 text-sm text-red-600">{error}</p>}
      </Card>
    </section>
  );
}
