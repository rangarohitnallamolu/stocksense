'use client';
import { useEffect, useState } from 'react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [token,  setToken]  = useState<string | null>(null);
  const [ready,  setReady]  = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user    = await getCurrentUser();
        const session = await fetchAuthSession();
        setUserId(user.userId);
        setToken(session.tokens?.idToken?.toString() ?? null);
      } catch {}
      setReady(true);
    })();
  }, []);

  return { userId, token, ready };
}
