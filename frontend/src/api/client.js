import axios from 'axios';
import toast from 'react-hot-toast';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000'
});

api.interceptors.request.use((config) => {
  const token = JSON.parse(localStorage.getItem('taskflow_auth') || '{}').accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('taskflow_auth');
      if (!location.pathname.includes('/login')) window.dispatchEvent(new Event('taskflow:auth-expired'));
    }
    const message = error.response?.data?.message || error.message || 'Something went wrong';
    if (!error.config?.silent) toast.error(message);
    return Promise.reject(error);
  }
);
