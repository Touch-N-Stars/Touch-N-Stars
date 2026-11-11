import { getUrls, rawHttp } from '@/services/api/core';

// The global client's error interceptor converts HTTP failures into successful mocks.
// Hardware controls must preserve actual status codes and firmware error messages.

export async function rpaRequest(operation, body) {
  const { BASE_URL } = getUrls();
  try {
    const response = await rawHttp({
      url: `${BASE_URL}/mlastro/${operation}`,
      method: body === undefined ? 'GET' : 'POST',
      data: body,
      timeout: operation === 'connect' || operation === 'reconnect' ? 55000 : 16000,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'RPA request failed');
  }
}
