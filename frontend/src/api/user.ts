import type { ApiUser } from '@shared/api-interfaces';

export async function getUser(): Promise<ApiUser> {
  const response = await fetch('/api/user');
  return response.json();
}

export async function login(): Promise<void> {
  const response = await fetch('/api/auth', {
    method: 'POST',
  });
  const data = await response.json();
  localStorage.setItem('token', data.token);
}
