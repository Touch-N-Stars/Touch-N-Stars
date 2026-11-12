import { getUrls, rawHttp } from '@/services/api/core';

// The global client's error interceptor converts HTTP failures into successful mocks.
// Hardware controls must preserve actual status codes and firmware error messages.

// A command that got no answer in time may still run: the request was already on its way.
export const UNCONFIRMED_COMMAND =
  'No answer in time. The command may have been executed: check the status before repeating it.';

const isTimeout = (error) =>
  !error.response && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT');

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
    if (body !== undefined && isTimeout(error)) throw new Error(UNCONFIRMED_COMMAND);
    throw new Error(error.response?.data?.error || error.message || 'RPA request failed');
  }
}
