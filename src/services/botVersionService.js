const { request } = require("./apiService");

async function getLatestBotVersion() {
  const payload = await request("/get_bot_version.php");
  const version = normalizeVersionPayload(payload);

  if (!version?.version) {
    throw new Error("Bot version API returned an invalid response.");
  }

  return version;
}

function normalizeVersionPayload(payload) {
  const body = parsePayload(payload);
  const data = isPlainObject(body?.data) ? body.data : body;

  if (!isPlainObject(data)) {
    return null;
  }

  const version = toCleanString(data.version);

  if (!version) {
    return null;
  }

  return {
    version,
    releaseDate: toCleanString(data.release_date || data.releaseDate),
    features: normalizeFeatures(data.features),
  };
}

function normalizeFeatures(features) {
  if (!Array.isArray(features)) {
    return [];
  }

  return features
    .map((feature) => toCleanString(feature))
    .filter(Boolean);
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

function toCleanString(value) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  getLatestBotVersion,
};
