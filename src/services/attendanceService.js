const { request } = require("./apiService");

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STUDENT_NAME_KEYS = [
  "student_name",
  "studentName",
  "student",
  "name",
  "full_name",
  "fullName",
];

const PHOTO_URL_KEYS = [
  "photo_url",
  "photoUrl",
  "student_photo_url",
  "studentPhotoUrl",
  "profile_photo_url",
  "profilePhotoUrl",
  "profile_photo",
  "profilePhoto",
  "image_url",
  "imageUrl",
];

const MONTHLY_SOURCE_KEYS = [
  "monthly",
  "month_attendance",
  "monthly_attendance",
  "current_month",
  "selected_month",
];

const OVERALL_SOURCE_KEYS = [
  "overall",
  "overall_attendance",
  "total_attendance",
  "cumulative",
  "summary",
];

const MONTHLY_STAT_KEYS = {
  percentage: [
    "monthly_percentage",
    "month_percentage",
    "current_month_percentage",
    "attendance_percentage",
    "percentage",
    "percent",
    "attendance_percent",
  ],
  conducted: [
    "month_conducted",
    "monthly_conducted",
    "monthly_classes_conducted",
    "month_classes_conducted",
    "classes_conducted",
    "conducted",
    "total_classes",
    "total",
    "working_days",
  ],
  attended: [
    "month_attended",
    "monthly_attended",
    "monthly_classes_attended",
    "month_classes_attended",
    "classes_attended",
    "attended",
    "present",
    "present_classes",
  ],
  missed: [
    "month_missed",
    "monthly_missed",
    "monthly_classes_missed",
    "month_classes_missed",
    "classes_missed",
    "missed",
    "absent",
    "absent_classes",
  ],
};

const OVERALL_STAT_KEYS = {
  percentage: [
    "overall_percentage",
    "overall_attendance_percentage",
    "total_percentage",
    "total_attendance_percentage",
    "percentage",
    "percent",
  ],
  conducted: [
    "overall_classes_conducted",
    "overall_total_classes",
    "total_classes_conducted",
    "total_classes",
    "overall_conducted",
    "classes_conducted",
    "conducted",
    "total",
  ],
  attended: [
    "overall_classes_attended",
    "overall_attended",
    "total_classes_attended",
    "total_attended",
    "classes_attended",
    "attended",
    "present",
  ],
  missed: [
    "overall_classes_missed",
    "overall_missed",
    "total_classes_missed",
    "total_missed",
    "classes_missed",
    "missed",
    "absent",
  ],
};

async function getAttendance(rollNo, month, year) {
  const payload = await request("/get_attendance.php", {
    roll_no: rollNo,
    month,
    year,
  });

  return normalizeAttendance(payload, month, year);
}

function normalizeAttendance(payload, month, year) {
  const body = parsePayload(payload);

  if (isNoDataResponse(body)) {
    return null;
  }

  const record = unwrapRecord(body);

  if (!isPlainObject(record)) {
    return null;
  }

  const monthlySource =
    pickObject(record, MONTHLY_SOURCE_KEYS) ||
    pickObject(body, MONTHLY_SOURCE_KEYS) ||
    record;
  const overallSource =
    pickObject(record, OVERALL_SOURCE_KEYS) ||
    pickObject(body, OVERALL_SOURCE_KEYS) ||
    record;
  const monthly = buildStats(monthlySource, MONTHLY_STAT_KEYS);
  const overall = buildStats(overallSource, OVERALL_STAT_KEYS);

  if (!hasStats(monthly) && !hasStats(overall)) {
    return null;
  }

  return {
    studentName:
      toCleanString(pickValue(record, STUDENT_NAME_KEYS)) ||
      toCleanString(pickValue(body, STUDENT_NAME_KEYS)) ||
      "Student",
    photoUrl:
      toCleanString(pickValue(record, PHOTO_URL_KEYS)) ||
      toCleanString(pickValue(body, PHOTO_URL_KEYS)) ||
      null,
    month,
    monthName: MONTH_NAMES[Number(month) - 1] || month,
    year: String(year),
    monthly,
    overall,
  };
}

function buildStats(source, statKeys) {
  const conducted = toNumber(pickValue(source, statKeys.conducted));
  const attended = toNumber(pickValue(source, statKeys.attended));
  let missed = toNumber(pickValue(source, statKeys.missed));

  if (missed == null && conducted != null && attended != null) {
    missed = Math.max(conducted - attended, 0);
  }

  return {
    percentage: toNumber(pickValue(source, statKeys.percentage)),
    conducted,
    attended,
    missed,
  };
}

function hasStats(stats) {
  return Object.values(stats).some((value) => value != null);
}

function unwrapRecord(value) {
  const body = parsePayload(value);

  if (Array.isArray(body)) {
    return body.find(isPlainObject) || null;
  }

  if (!isPlainObject(body)) {
    return null;
  }

  for (const key of ["data", "record", "attendance", "result", "details"]) {
    const nested = body[key];

    if (Array.isArray(nested)) {
      return nested.find(isPlainObject) || null;
    }

    if (isPlainObject(nested)) {
      return nested;
    }
  }

  for (const key of ["records", "items", "rows"]) {
    const nested = body[key];

    if (Array.isArray(nested)) {
      return nested.find(isPlainObject) || null;
    }
  }

  return body;
}

function isNoDataResponse(value) {
  if (value == null) {
    return true;
  }

  if (typeof value === "string") {
    return /not\s+found|no\s+(attendance\s+)?data|no\s+record|unavailable|invalid/i.test(
      value
    );
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (!isPlainObject(value)) {
    return false;
  }

  const status = toCleanString(pickValue(value, ["status", "success"]));
  const message = toCleanString(pickValue(value, ["message", "error"]));

  if (/^(false|0|failed|failure|error|not_found|no_data)$/i.test(status)) {
    return true;
  }

  return Boolean(message) && isNoDataResponse(message);
}

function pickObject(source, keys) {
  const value = pickValue(source, keys);
  return isPlainObject(value) ? value : null;
}

function pickValue(source, keys) {
  const body = parsePayload(source);

  if (!isPlainObject(body)) {
    return null;
  }

  for (const key of keys) {
    const normalizedKey = normalizeKey(key);

    for (const [candidateKey, value] of Object.entries(body)) {
      if (normalizeKey(candidateKey) === normalizedKey && value !== "") {
        return value;
      }
    }
  }

  return null;
}

function toNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(String(value).replace(/[%\s,]/g, ""));

  return Number.isFinite(numeric) ? numeric : null;
}

function toCleanString(value) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
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

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  getAttendance,
};
