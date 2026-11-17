import axios from 'axios';
import { getUrls } from '@/services/api/core';

export const luckyCaptureUrl = (path) => `${getUrls().API_URL}v1/luckycapture/${path}`;
export async function luckyCaptureRequest(path, data, method = 'GET', signal) {
  const response = await axios({
    url: luckyCaptureUrl(path),
    method,
    data,
    signal,
    timeout: 45000,
  });
  return response.data;
}
