import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';

export async function authSignUp(email: string, password: string, name: string) {
  return signUp({
    username: email,
    password,
    options: { userAttributes: { email, name } },
  });
}

export async function authConfirmSignUp(email: string, code: string) {
  return confirmSignUp({ username: email, confirmationCode: code });
}

export async function authSignIn(email: string, password: string) {
  try {
    return await signIn({ username: email, password });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('already a signed') || msg.includes('UserAlreadyAuthenticated')) {
      await signOut();
      return signIn({ username: email, password });
    }
    throw err;
  }
}

export async function authSignOut() {
  return signOut();
}

export async function authForgotPassword(email: string) {
  return resetPassword({ username: email });
}

export async function authConfirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
) {
  return confirmResetPassword({ username: email, confirmationCode: code, newPassword });
}

export async function getUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export async function getIdToken() {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}
