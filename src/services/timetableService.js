const { API_BASE_URL, request } = require("./apiService");

const IMAGE_URL_KEYS = [
  "image_url",
  "imageUrl",
  "timetable_url",
  "timetableUrl",
  "photo_url",
  "photoUrl",
  "file_url",
  "fileUrl",
  "image",
  "photo",
  "timetable",
  "url",
  "file",
  "path",
];

async function getTimetable() {
  const payload = await request("/get_timetable.php");
  const imageUrl = findImageUrl(parsePayload(payload));

  return imageUrl ? { imageUrl } : null;
}

function findImageUrl(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return normalizeImageUrl(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const imageUrl = findImageUrl(item);

      if (imageUrl) {
        return imageUrl;
      }
    }

    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const key of IMAGE_URL_KEYS) {
    const imageUrl = normalizeImageUrl(pickValue(value, key));

    if (imageUrl) {
      return imageUrl;
    }
  }

  for (const key of ["data", "record", "result", "timetable", "image"]) {
    if (value[key] == null) {
      continue;
    }

    const imageUrl = findImageUrl(value[key]);

    if (imageUrl) {
      return imageUrl;
    }
  }

  return null;
}

function normalizeImageUrl(value) {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();

  if (!text || /not\s+found|unavailable|no\s+data/i.test(text)) {
    return null;
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (/^(\/|\.\.?\/|[A-Za-z0-9_-]+\/)/.test(text)) {
    return new URL(text, `${API_BASE_URL}/`).toString();
  }

  return null;
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
    return trimmed;
  }
}

function pickValue(item, key) {
  if (!isPlainObject(item)) {
    return null;
  }

  const normalizedKey = normalizeKey(key);

  for (const [candidateKey, value] of Object.entries(item)) {
    if (normalizeKey(candidateKey) === normalizedKey) {
      return value;
    }
  }

  return null;
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  getTimetable,
};
