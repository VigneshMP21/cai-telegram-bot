const crypto = require("crypto");

const MAX_CALLBACK_DATA_BYTES = 64;
const SUBJECT_REFERENCE_TTL_MS = 6 * 60 * 60 * 1000;
const subjectReferences = new Map();

function buildSubjectCallbackData(prefix, semester, subject) {
  const encodedSubject = encodeSubject(subject);
  const callbackData = `${prefix}_subject_${semester}_${encodedSubject}`;

  if (Buffer.byteLength(callbackData, "utf8") <= MAX_CALLBACK_DATA_BYTES) {
    return callbackData;
  }

  const referenceId = storeSubjectReference(semester, subject);
  return `${prefix}_subject_ref_${referenceId}`;
}

function encodeSubject(subject) {
  return Buffer.from(String(subject), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeSubject(encodedSubject) {
  try {
    let base64 = String(encodedSubject).replace(/-/g, "+").replace(/_/g, "/");

    while (base64.length % 4) {
      base64 += "=";
    }

    return Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function storeSubjectReference(semester, subject) {
  cleanupExpiredReferences();

  const id = crypto.randomBytes(8).toString("hex");

  subjectReferences.set(id, {
    semester: String(semester),
    subject: String(subject),
    expiresAt: Date.now() + SUBJECT_REFERENCE_TTL_MS,
  });

  return id;
}

function resolveSubjectReference(id) {
  cleanupExpiredReferences();

  const reference = subjectReferences.get(id);

  if (!reference) {
    return null;
  }

  if (reference.expiresAt <= Date.now()) {
    subjectReferences.delete(id);
    return null;
  }

  return reference;
}

function cleanupExpiredReferences() {
  const now = Date.now();

  for (const [id, reference] of subjectReferences.entries()) {
    if (reference.expiresAt <= now) {
      subjectReferences.delete(id);
    }
  }
}

module.exports = {
  buildSubjectCallbackData,
  decodeSubject,
  resolveSubjectReference,
};
