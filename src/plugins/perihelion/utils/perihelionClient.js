import axios from 'axios';
import { getPerihelionToken } from './perihelionAuth';

// Every Perihelion call goes through this instance instead of the raw axios default export, so
// the auth token is attached in one place rather than at each of the ~15 call sites.
const perihelionApi = axios.create();

perihelionApi.interceptors.request.use((config) => {
  const token = getPerihelionToken();
  if (token) {
    config.headers = { ...config.headers, 'X-Perihelion-Token': token };
  }
  return config;
});

export default perihelionApi;
