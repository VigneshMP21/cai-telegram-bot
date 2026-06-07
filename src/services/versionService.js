const { API_BASE_URL, post, postJson, request } = require("./apiService");

const VERSION_ENDPOINT = "/get_bot_version.php";
const SAVE_USER_ENDPOINT = "/save_bot_user.php";
const UPDATE_USER_VERSION_ENDPOINT = "/update_user_version.php";

const VERSION_KEYS = ["version", "latest_version", "latestVersion", "bot_version"];
const RELEASE_NOTE_KEYS = ["release_notes", "releaseNotes", "notes"];
const FEATURE_KEYS = ["features", "release_notes", "releaseNotes"];
const LAST_VERSION_KEYS = [
  "last_version_seen",
  "lastVersionSeen",
  "last_seen_version",
  "lastSeenVersion",
  "last_version",
  "lastVersion",
  "current_version",
  "currentVersion",
  "seen_version",
  "seenVersion",
  "bot_version_seen",
];

async function getLatestVersion() {
  const payload = assertSuccessfulPayload(
    await request(VERSION_ENDPOINT),
    "get latest bot version"
  );
  const latestVersion = normalizeVersionPayload(payload);

  if (!latestVersion?.version) {
    throw new Error("Bot version API returned an invalid response.");
  }

  return latestVersion;
}

async function saveBotUser(user) {
  const normalizedUser = normalizeUser(user);
  const requestPayload = buildSaveBotUserPayload(normalizedUser);
  const requestUrl = buildApiUrl(SAVE_USER_ENDPOINT);

  logSaveBotUserRequest(requestUrl, requestPayload);

  let responseBody;

  try {
    responseBody = await postJson(SAVE_USER_ENDPOINT, requestPayload);
    console.log("[CAI_BOT] saveBotUser response body", responseBody);
  } catch (error) {
    console.error("[CAI_BOT] saveBotUser error.response.data", {
      status: error?.response?.status || null,
      data: error?.response?.data || null,
    });
    throw error;
  }

  const payload = assertSuccessfulPayload(responseBody, "save bot user");

  return normalizeUserVersionPayload(payload, normalizedUser);
}

async function updateUserVersion(user, latestVersion) {
  const version = toCleanString(latestVersion);

  if (!version) {
    throw new Error("latestVersion is required to update a bot user.");
  }

  const normalizedUser = normalizeUser(user);
  const requestPayload = {
    ...buildUserPayload(normalizedUser),
    version,
    latest_version: version,
    last_version_seen: version,
    current_version: version,
  };
  const requestUrl = buildApiUrl(UPDATE_USER_VERSION_ENDPOINT);

  console.log("[CAI_BOT] updateUserVersion URL", requestUrl);
  console.log("[CAI_BOT] updateUserVersion payload", requestPayload);

  let responseBody;

  try {
    responseBody = await post(UPDATE_USER_VERSION_ENDPOINT, requestPayload);
    console.log("[CAI_BOT] updateUserVersion response body", responseBody);
  } catch (error) {
    console.error("[CAI_BOT] updateUserVersion error.response.data", {
      status: error?.response?.status || null,
      data: error?.response?.data || null,
    });
    throw error;
  }

  const payload = assertSuccessfulPayload(responseBody, "update bot user version");

  return normalizeUserVersionPayload(payload, normalizedUser, version);
}

function normalizeVersionPayload(payload) {
  const body = parsePayload(payload);
  const version = toCleanString(findValueByKeys(body, VERSION_KEYS));

  if (!version) {
    return null;
  }

  const releaseNotes = toCleanString(findValueByKeys(body, RELEASE_NOTE_KEYS));

  return {
    version,
    releaseNotes,
    features: normalizeFeatures(body, releaseNotes),
    raw: body,
  };
}

function normalizeUserVersionPayload(payload, user, fallbackVersion = null) {
  const body = parsePayload(payload);
  const record = findRecordByKeys(body, LAST_VERSION_KEYS) || {};
  const lastVersionSeen =
    toCleanString(record.last_version_seen) ||
    toCleanString(findValueByKeys(body, LAST_VERSION_KEYS)) ||
    toCleanString(fallbackVersion) ||
    null;

  return {
    telegram_user_id:
      toCleanString(record.telegram_user_id) || user.telegramUserId,
    telegramUserId: user.telegramUserId,
    username: toCleanString(record.username) || user.username,
    last_version_seen: lastVersionSeen,
    lastVersionSeen,
    raw: body,
  };
}

function assertSuccessfulPayload(payload, operation) {
  const body = parsePayload(payload);

  if (isPlainObject(body) && body.status === false) {
    throw new Error(
      toCleanString(body.message || body.error) ||
        `CAI API failed to ${operation}.`
    );
  }

  return body;
}

function normalizeUser(user) {
  const telegramUserId = toCleanString(
    user?.telegramUserId ||
      user?.telegram_user_id ||
      user?.telegramId ||
      user?.userId ||
      user?.id
  );

  if (!telegramUserId) {
    throw new Error("telegramUserId is required to save a bot user.");
  }

  return {
    telegramUserId,
    username: toCleanString(user?.username) || null,
    firstName: toCleanString(user?.firstName || user?.first_name) || null,
    lastName: toCleanString(user?.lastName || user?.last_name) || null,
    lastVersionSeen:
      toCleanString(user?.lastVersionSeen || user?.last_version_seen) || null,
  };
}

function buildUserPayload(user) {
  return removeEmptyValues({
    telegram_user_id: user.telegramUserId,
    telegramUserId: user.telegramUserId,
    telegram_id: user.telegramUserId,
    user_id: user.telegramUserId,
    username: user.username,
    first_name: user.firstName,
    last_name: user.lastName,
  });
}

function buildSaveBotUserPayload(user) {
  return {
    telegram_user_id: user.telegramUserId,
    username: user.username,
  };
}

function buildApiUrl(endpoint) {
  return `${API_BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}

function logSaveBotUserRequest(url, payload) {
  const requestBody = JSON.stringify(payload);

  console.log("[CAI_BOT] saveBotUser URL", url);
  console.log("[CAI_BOT] saveBotUser payload", payload);
  console.log("[CAI_BOT] saveBotUser request body", requestBody);
  console.log("[CAI_BOT] saveBotUser headers", {
    "Content-Type": "application/json",
  });
}

function normalizeFeatures(body, releaseNotes) {
  for (const key of FEATURE_KEYS) {
    const value = findValueByKeys(body, [key]);
    const features = normalizeFeatureValue(value);

    if (features.length) {
      return features;
    }
  }

  return normalizeFeatureValue(releaseNotes);
}

function normalizeFeatureValue(value) {
  if (Array.isArray(value)) {
    return value.map(cleanFeatureText).filter(Boolean);
  }

  const text = toCleanString(value);

  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n|,|;/)
    .map(cleanFeatureText)
    .filter(Boolean);
}

function cleanFeatureText(value) {
  return toCleanString(value)
    .replace(/^[\s*-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findValueByKeys(value, keys) {
  const body = parsePayload(value);

  if (body == null) {
    return null;
  }

  if (Array.isArray(body)) {
    for (const item of body) {
      const found = findValueByKeys(item, keys);

      if (found != null && found !== "") {
        return found;
      }
    }

    return null;
  }

  if (!isPlainObject(body)) {
    return null;
  }

  for (const key of keys) {
    if (body[key] != null && body[key] !== "") {
      return body[key];
    }
  }

  for (const key of ["data", "user", "record", "result", "response"]) {
    if (body[key] == null) {
      continue;
    }

    const found = findValueByKeys(body[key], keys);

    if (found != null && found !== "") {
      return found;
    }
  }

  return null;
}

function findRecordByKeys(value, keys) {
  const body = parsePayload(value);

  if (body == null) {
    return null;
  }

  if (Array.isArray(body)) {
    for (const item of body) {
      const found = findRecordByKeys(item, keys);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (!isPlainObject(body)) {
    return null;
  }

  if (keys.some((key) => body[key] != null && body[key] !== "")) {
    return body;
  }

  for (const key of ["data", "user", "record", "result", "response"]) {
    if (body[key] == null) {
      continue;
    }

    const found = findRecordByKeys(body[key], keys);

    if (found) {
      return found;
    }
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

function toCleanString(value) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function removeEmptyValues(values) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value != null && value !== "")
  );
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  getLatestVersion,
  saveBotUser,
  updateUserVersion,
};
