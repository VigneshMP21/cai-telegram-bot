const axios = require("axios");
const {
  isInfinityFreeChallenge,
  solveInfinityFreeChallenge,
} = require("../utils/infinityFree");

const API_BASE_URL =
  process.env.CAI_API_BASE_URL || "https://sietkcai.infinityfreeapp.com/api";
const API_TIMEOUT_MS = Number(process.env.CAI_API_TIMEOUT_MS || 15000);
const DEFAULT_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  validateStatus: () => true,
  headers: DEFAULT_HEADERS,
});

let infinityFreeCookie = null;

const SEMESTER_KEYS = ["semester", "sem", "semester_id", "id", "name", "title"];
const SUBJECT_KEYS = ["subject", "subject_name", "name", "title"];
const MATERIAL_FILE_KEYS = [
  "file_url",
  "fileUrl",
  "material_url",
  "pdf_url",
  "download_url",
  "url",
  "file",
];

async function getSemesters(type) {
  const payload = await request("/get_semesters.php", { type });
  const semesters = normalizeList(payload, ["semesters"], SEMESTER_KEYS)
    .map(normalizeSemester)
    .filter(Boolean);

  return unique(semesters).sort(sortSemesters);
}

async function getSubjects(type, semester) {
  const payload = await request("/get_subjects.php", { type, semester });
  const subjects = normalizeList(payload, ["subjects"], SUBJECT_KEYS);

  return unique(subjects);
}

async function getMaterial(type, semester, subject) {
  const payload = await request("/get_material.php", {
    type,
    semester,
    subject,
  });

  return normalizeMaterial(payload);
}

async function request(endpoint, params) {
  const response = await getWithNetworkRetry(endpoint, {
    params,
    headers: buildRequestHeaders(),
  });
  const payload = parsePayload(response.data);

  if (!isInfinityFreeChallenge(payload)) {
    if (response.status >= 500) {
      throw new Error(`CAI API request failed with status ${response.status}.`);
    }

    return payload;
  }

  infinityFreeCookie = solveInfinityFreeChallenge(payload);

  if (!infinityFreeCookie) {
    throw new Error("Unable to solve InfinityFree API challenge.");
  }

  const retryResponse = await getWithNetworkRetry(endpoint, {
    params: { ...params, i: 1 },
    headers: buildRequestHeaders(),
  });
  const retryPayload = parsePayload(retryResponse.data);

  if (isInfinityFreeChallenge(retryPayload)) {
    throw new Error("InfinityFree API challenge retry failed.");
  }

  if (retryResponse.status >= 500) {
    throw new Error(`CAI API retry failed with status ${retryResponse.status}.`);
  }

  return retryPayload;
}

async function post(endpoint, data) {
  const body = encodeFormData(data);
  const headers = buildRequestHeaders({
    "Content-Type": "application/x-www-form-urlencoded",
  });
  const response = await postWithNetworkRetry(endpoint, body, {
    headers,
  });
  const payload = parsePayload(response.data);

  if (!isInfinityFreeChallenge(payload)) {
    if (response.status >= 400) {
      throw new Error(`CAI API POST request failed with status ${response.status}.`);
    }

    return payload;
  }

  infinityFreeCookie = solveInfinityFreeChallenge(payload);

  if (!infinityFreeCookie) {
    throw new Error("Unable to solve InfinityFree API challenge.");
  }

  const retryResponse = await postWithNetworkRetry(endpoint, body, {
    params: { i: 1 },
    headers: buildRequestHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
    }),
  });
  const retryPayload = parsePayload(retryResponse.data);

  if (isInfinityFreeChallenge(retryPayload)) {
    throw new Error("InfinityFree API challenge retry failed.");
  }

  if (retryResponse.status >= 400) {
    throw new Error(`CAI API POST retry failed with status ${retryResponse.status}.`);
  }

  return retryPayload;
}

async function getWithNetworkRetry(endpoint, options) {
  try {
    return await apiClient.get(endpoint, options);
  } catch (error) {
    if (!isRetryableNetworkError(error)) {
      throw error;
    }

    console.error("[CAI_BOT] API network error, retrying once", {
      endpoint,
      code: error.code,
      message: error.message,
    });

    return apiClient.get(endpoint, options);
  }
}

async function postWithNetworkRetry(endpoint, data, options) {
  try {
    return await apiClient.post(endpoint, data, options);
  } catch (error) {
    if (!isRetryableNetworkError(error)) {
      throw error;
    }

    console.error("[CAI_BOT] API POST network error, retrying once", {
      endpoint,
      code: error.code,
      message: error.message,
    });

    return apiClient.post(endpoint, data, options);
  }
}

function parsePayload(payload) {
  if (typeof payload !== "string") {
    return payload;
  }

  const trimmed = payload.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return payload;
  }
}

function buildRequestHeaders(extraHeaders = {}) {
  const headers = {
    ...DEFAULT_HEADERS,
    ...extraHeaders,
  };

  if (!infinityFreeCookie) {
    return headers;
  }

  return {
    ...headers,
    Cookie: infinityFreeCookie,
  };
}

function encodeFormData(data = {}) {
  const formData = new URLSearchParams();

  Object.entries(data).forEach(([key, value]) => {
    if (value == null || value === "") {
      return;
    }

    formData.append(key, String(value));
  });

  return formData.toString();
}

function isRetryableNetworkError(error) {
  return [
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNABORTED",
    "EAI_AGAIN",
    "ENOTFOUND",
  ].includes(error?.code);
}

function normalizeList(payload, collectionKeys, valueKeys) {
  return pickCollection(payload, collectionKeys)
    .map((item) => pickScalarValue(item, valueKeys))
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter(Boolean);
}

function pickCollection(payload, collectionKeys) {
  const body = parsePayload(payload);

  if (Array.isArray(body)) {
    return body;
  }

  if (!isPlainObject(body)) {
    return [];
  }

  for (const key of collectionKeys) {
    if (Array.isArray(body[key])) {
      return body[key];
    }
  }

  for (const key of ["data", "records", "items", "result", "response"]) {
    const value = body[key];

    if (Array.isArray(value)) {
      return value;
    }

    if (isPlainObject(value)) {
      const nested = pickCollection(value, collectionKeys);

      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
}

function pickScalarValue(item, keys) {
  if (item == null) {
    return null;
  }

  if (typeof item === "string" || typeof item === "number") {
    return item;
  }

  if (!isPlainObject(item)) {
    return null;
  }

  for (const key of keys) {
    if (item[key] != null && item[key] !== "") {
      return item[key];
    }
  }

  const primitiveValues = Object.values(item).filter(
    (value) => typeof value === "string" || typeof value === "number"
  );

  return primitiveValues.length === 1 ? primitiveValues[0] : null;
}

function pickValueByKeys(item, keys) {
  if (!isPlainObject(item)) {
    return null;
  }

  for (const key of keys) {
    if (item[key] != null && item[key] !== "") {
      return item[key];
    }
  }

  return null;
}

function normalizeMaterial(payload) {
  const candidates = [];
  collectMaterialCandidates(parsePayload(payload), candidates);

  for (const candidate of candidates) {
    if (typeof candidate === "string" && isLikelyUrl(candidate)) {
      return { file_url: candidate.trim() };
    }

    if (!isPlainObject(candidate)) {
      continue;
    }

    const fileUrl = pickValueByKeys(candidate, MATERIAL_FILE_KEYS);

    if (fileUrl && isLikelyUrl(fileUrl)) {
      return {
        ...candidate,
        file_url: String(fileUrl).trim(),
      };
    }
  }

  return null;
}

function collectMaterialCandidates(value, candidates) {
  if (value == null) {
    return;
  }

  if (typeof value === "string") {
    candidates.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectMaterialCandidates(item, candidates));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  candidates.push(value);

  for (const key of ["data", "record", "material", "file", "result", "items"]) {
    if (value[key] != null) {
      collectMaterialCandidates(value[key], candidates);
    }
  }
}

function normalizeSemester(value) {
  const text = String(value).trim();
  const match = text.match(/\d+/);
  return match ? match[0] : text;
}

function unique(values) {
  return [...new Set(values)];
}

function sortSemesters(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return String(left).localeCompare(String(right));
}

function isLikelyUrl(value) {
  return /^https?:\/\//i.test(String(value).trim());
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  API_BASE_URL,
  request,
  post,
  getSemesters,
  getSubjects,
  getMaterial,
};
