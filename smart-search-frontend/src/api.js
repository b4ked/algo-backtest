import axios from "axios";

const proxiedApi = axios.create({
  baseURL: "/api",
  timeout: 180_000,
});

const directApi = axios.create({
  baseURL: "http://localhost:8001/api",
  timeout: 180_000,
});

async function requestWithFallback(config) {
  try {
    return await proxiedApi.request(config);
  } catch (error) {
    if (error?.response?.status === 404) {
      return directApi.request(config);
    }
    throw error;
  }
}

export async function fetchStrategies() {
  const { data } = await requestWithFallback({ method: "get", url: "/strategies" });
  return data.strategies ?? [];
}

export async function runSmartSearch(payload) {
  const { data } = await requestWithFallback({
    method: "post",
    url: "/smart-search",
    data: payload,
  });
  return data;
}
