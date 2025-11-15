export const login = async (): Promise<void> => {
  const response = await fetch('/api/auth', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate');
  }
};
