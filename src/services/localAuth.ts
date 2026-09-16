const ADMIN_SESSION_KEY = 'unn_cbt_local_admin_session';
const LOCAL_ADMIN_EMAIL = 'admin@localhost.local';
const LOCAL_ADMIN_PASSWORD = 'admin123';

export function isLocalAdminAuthenticated(): boolean {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'authenticated';
}

export async function authenticateAdmin(email: string, password: string): Promise<void> {
  if (
    email.trim().toLowerCase() !== LOCAL_ADMIN_EMAIL ||
    password !== LOCAL_ADMIN_PASSWORD
  ) {
    const error = new Error('Invalid local administrator credentials') as Error & {
      code: string;
    };
    error.code = 'auth/invalid-credential';
    throw error;
  }

  sessionStorage.setItem(ADMIN_SESSION_KEY, 'authenticated');
}

export function logoutAdmin(): void {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export { LOCAL_ADMIN_EMAIL };
