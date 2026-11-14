import { useCallback, useRef, useState } from 'react';
import { queryMatch } from './api.js';

export function useMatchChat(apiClient, matchId, sessionId) {
  const [messages, setMessages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMountedRef = useRef(true);

  const submitQuery = useCallback(
    async (rawQuery) => {
      const queryText = typeof rawQuery === 'string' ? rawQuery.trim() : '';
      if (!queryText || queryText.length < 3 || isSubmitting || !apiClient || !matchId) {
        return;
      }

      setIsSubmitting(true);
      const timestamp = new Date().toISOString();
      const userMessageId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const assistantMessageId = `asst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const userMessage = {
        id: userMessageId,
        sender: 'user',
        text: queryText,
        timestamp
      };

      const pendingAssistantMessage = {
        id: assistantMessageId,
        sender: 'assistant',
        queryText,
        status: 'loading',
        timestamp
      };

      setMessages((prev) => [...prev, userMessage, pendingAssistantMessage]);

      try {
        const result = await queryMatch(apiClient, matchId, {
          query: queryText,
          sessionId
        });

        if (!isMountedRef.current) return;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, status: 'success', result }
              : msg
          )
        );
      } catch (err) {
        if (!isMountedRef.current) return;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  status: 'error',
                  error: {
                    status: err?.status,
                    message: err?.message || 'Unable to process query.'
                  }
                }
              : msg
          )
        );
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [apiClient, matchId, sessionId, isSubmitting]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isSubmitting,
    submitQuery,
    clearChat
  };
}
