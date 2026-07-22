import { fetchAuthSession } from 'aws-amplify/auth';

export async function authFetch(url: string, options?: RequestInit) {
  const session = await fetchAuthSession();
  const token   = session.tokens?.idToken?.toString() ?? '';
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

// Extract Cognito sub from JWT (server-side, no crypto verify needed in dev)
export function getUserIdFromRequest(req: Request): string | null {
  const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!auth) return null;
  try {
    const payload = JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString());
    return payload.sub ?? null;
  } catch { return null; }
}

// Ensure user row exists
export async function ensureUserProfile(db: import('pg').Pool, userId: string, email?: string) {
  await db.query(
    `INSERT INTO user_profiles (user_id, email) VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, email ?? `${userId}@unknown`]
  );
}
