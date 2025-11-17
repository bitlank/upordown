
const BASE_URL = '/api';

async function fetchApi(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<Response> {
  const url = `${BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : null,
  };

  let retry = true;
  for (let attempt = 0; retry; attempt++) {
    retry = attempt < 3;

    try {
      const response = await fetch(url, options);

      if (response.status === 401) {
        retry = false;
        throw new Error('401 Unauthorized');
      }

      if (!response.ok) {
        retry = false;
        throw new Error(`API Error: ${response.status}`);
      }

      return response;
    } catch (error: any) {
      if (!retry) {
        throw error;
      }

      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}

export async function fetchJson<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any): Promise<T> {
  const response = await fetchApi(endpoint, method, body);

  const text = await response.text();
  if (!text) {
    throw new Error("Empty response");
  }

  return JSON.parse(text) as T;
}

export async function fetchEmpty(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any): Promise<void> {
  await fetchApi(endpoint, method, body);
}


