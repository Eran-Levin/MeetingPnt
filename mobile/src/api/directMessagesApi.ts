import type { DirectMessage, DirectThread } from '@meetingpnt/shared';
import { apiFetch } from './client';

export const directMessagesApi = {
  thread: (userId: string) =>
    apiFetch<{ thread: DirectThread }>(`/api/direct-messages/${userId}`),
  send: (
    userId: string,
    body: string | undefined,
    image: { uri: string; name: string; type: string } | undefined,
  ) =>
    apiFetch<{ message: DirectMessage }>(`/api/direct-messages/${userId}`, {
      method: 'POST',
      formData: () => {
        const formData = new FormData();
        if (body) formData.append('body', body);
        if (image) formData.append('image', image as unknown as Blob);
        return formData;
      },
    }),
};
