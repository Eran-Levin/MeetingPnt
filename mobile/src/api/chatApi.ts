import type { MessageWithAuthor } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const chatApi = {
  list: (groupId: string) =>
    apiFetch<{ messages: MessageWithAuthor[] }>(`/api/groups/${groupId}/messages`),
  send: (groupId: string, body: string | undefined, image: { uri: string; name: string; type: string } | undefined) => {
    const formData = new FormData();
    if (body) formData.append('body', body);
    if (image) {
      // React Native's fetch/FormData accepts this {uri,name,type} shape for file parts.
      formData.append('image', image as unknown as Blob);
    }
    return apiFetch<{ message: MessageWithAuthor }>(`/api/groups/${groupId}/messages`, {
      method: 'POST',
      formData,
    });
  },
};
