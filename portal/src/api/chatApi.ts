import type { MessageWithAuthor } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const chatApi = {
  list: (groupId: string) =>
    apiFetch<{ messages: MessageWithAuthor[] }>(`/api/groups/${groupId}/messages`),
  send: (groupId: string, body: string | undefined, image: File | undefined) => {
    const formData = new FormData();
    if (body) formData.set('body', body);
    if (image) formData.set('image', image);
    return apiFetch<{ message: MessageWithAuthor }>(`/api/groups/${groupId}/messages`, {
      method: 'POST',
      formData,
    });
  },
};
