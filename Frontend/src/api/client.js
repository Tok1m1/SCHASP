import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (localStorage.getItem("token")) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const getErrorMessage = (error) =>
  error?.response?.data?.error ||
  error?.message ||
  "Ошибка запроса. Проверьте подключение к серверу.";

export async function downloadFile(url, { params, filename, method = "get" } = {}) {
  const res = await api.request({
    url,
    method,
    params,
    responseType: "blob",
  });

  const blob = new Blob([res.data], {
    type: res.headers["content-type"] || "application/octet-stream",
  });

  let resolvedName = filename;
  const disposition = res.headers["content-disposition"];
  if (!resolvedName && disposition) {
    const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch) {
      resolvedName = decodeURIComponent(utfMatch[1]);
    } else {
      const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
      if (plainMatch) resolvedName = plainMatch[1];
    }
  }

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = resolvedName || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

export default api;
