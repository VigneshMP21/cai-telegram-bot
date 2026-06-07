const axios = require("axios");
const { API_BASE_URL, post } = require("./apiService");

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

const STUDENT_FOUND_KEYS = [
  "found",
  "exists",
  "student_found",
  "studentFound",
  "is_found",
  "isFound",
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
  const normalizedRollNo = normalizeRollNumber(rollNo);
  const requestParams = {
    roll_no: normalizedRollNo,
    month,
    year,
  };
  const attendanceUrl = buildApiUrl("/get_attendance_bot.php", requestParams);

  console.log("ROLL NUMBER:");
  console.log(normalizedRollNo);
  console.log("MONTH:");
  console.log(month);
  console.log("YEAR:");
  console.log(year);
  console.log("Attendance URL:", attendanceUrl);

  let payload;

  try {
    const response = await axios.get(buildApiUrl("/get_attendance_bot.php"), {
      params: requestParams,
    });

    rejectHtmlResponse(response.data);

    console.log("Attendance Response:");
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data?.status !== true) {
      return null;
    }

    payload = response.data.data;
  } catch (error) {
    console.log("Attendance Error:");
    console.log(error.response?.data);
    throw error;
  }

  return normalizeAttendance(payload, month, year);
}

async function checkStudent(rollNo) {
  const rollNumber = normalizeRollNumber(rollNo);
  const requestPayload = {
    roll_no: rollNumber,
  };
  const apiUrl = buildApiUrl("/check_student.php");

  console.log("API URL:");
  console.log(apiUrl);
  console.log("CHECK STUDENT REQUEST:", requestPayload);

  const responseData = await post("/check_student.php", requestPayload);

  console.log("CHECK STUDENT RESPONSE:", responseData);

  return normalizeStudentCheck(responseData, rollNumber);
}

function normalizeStudentCheck(payload, rollNo) {
  const body = parsePayload(payload);
  const message = getApiMessage(body);

  if (!isPlainObject(body) || body.status !== true) {
    return {
      status: false,
      message,
      student: null,
      raw: body,
    };
  }

  return {
    status: true,
    message,
    student: normalizeStudent(body, rollNo) || {
      rollNo,
      studentName: "Student",
      photoUrl: null,
    },
    raw: body,
  };
}

function normalizeStudent(payload, rollNo) {
  const body = parsePayload(payload);

  if (isNoDataResponse(body)) {
    return null;
  }

  if (hasExplicitFalse(body, STUDENT_FOUND_KEYS)) {
    return null;
  }

  if (hasEmptyData(body)) {
    return null;
  }

  const record = unwrapRecord(body);

  if (!isPlainObject(record)) {
    return null;
  }

  if (hasExplicitFalse(record, STUDENT_FOUND_KEYS)) {
    return null;
  }

  const status = toCleanString(pickValue(body, ["status", "success"]));

  if (
    record === body &&
    !/^(true|1|success|ok)$/i.test(status) &&
    !hasStudentIdentity(record)
  ) {
    return null;
  }

  return {
    rollNo:
      toCleanString(
        pickValue(record, ["roll_no", "rollNo", "roll_number", "rollNumber"])
      ) || rollNo,
    studentName:
      toCleanString(pickValue(record, STUDENT_NAME_KEYS)) ||
      toCleanString(pickValue(body, STUDENT_NAME_KEYS)) ||
      "Student",
    photoUrl:
      toCleanString(pickValue(record, PHOTO_URL_KEYS)) ||
      toCleanString(pickValue(body, PHOTO_URL_KEYS)) ||
      null,
  };
}

function hasEmptyData(value) {
  const body = parsePayload(value);

  if (!isPlainObject(body) || !Object.hasOwn(body, "data")) {
    return false;
  }

  const data = body.data;

  if (data == null) {
    return true;
  }

  if (Array.isArray(data)) {
    return data.length === 0;
  }

  if (isPlainObject(data)) {
    return Object.keys(data).length === 0;
  }

  return false;
}

function hasStudentIdentity(record) {
  return Boolean(
    toCleanString(
      pickValue(record, [
        "roll_no",
        "rollNo",
        "roll_number",
        "rollNumber",
        ...STUDENT_NAME_KEYS,
        ...PHOTO_URL_KEYS,
      ])
    )
  );
}

function hasExplicitFalse(value, keys) {
  const rawValue = pickValue(value, keys);

  if (rawValue == null || rawValue === "") {
    return false;
  }

  return /^(false|0|no|not_found|missing)$/i.test(String(rawValue).trim());
}

function getApiMessage(value) {
  const body = parsePayload(value);

  if (!isPlainObject(body)) {
    return "";
  }

  return toCleanString(
    pickValue(body, ["message", "error", "msg", "description"])
  );
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

  const flatMonthly = buildStats(record, {
    percentage: ["month_percentage"],
    conducted: ["month_conducted"],
    attended: ["month_attended"],
    missed: ["month_missed"],
  });
  const flatOverall = buildStats(record, {
    percentage: ["overall_percentage"],
    conducted: ["overall_conducted"],
    attended: ["overall_attended"],
    missed: ["overall_missed"],
  });
  const monthlySource =
    pickObject(record, MONTHLY_SOURCE_KEYS) ||
    pickObject(body, MONTHLY_SOURCE_KEYS) ||
    record;
  const overallSource =
    pickObject(record, OVERALL_SOURCE_KEYS) ||
    pickObject(body, OVERALL_SOURCE_KEYS) ||
    record;
  const monthly = mergeStats(
    buildStats(monthlySource, MONTHLY_STAT_KEYS),
    flatMonthly
  );
  const overall = mergeStats(
    buildStats(overallSource, OVERALL_STAT_KEYS),
    flatOverall
  );

  if (!hasStats(monthly) && !hasStats(overall)) {
    return null;
  }

  const normalizedAttendance = {
    rollNo:
      toCleanString(
        pickValue(record, ["roll_no", "rollNo", "roll_number", "rollNumber"])
      ) || null,
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

  console.log("NORMALIZED ATTENDANCE", normalizedAttendance);

  return normalizedAttendance;
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

function mergeStats(primary, fallback) {
  return {
    percentage: primary.percentage ?? fallback.percentage,
    conducted: primary.conducted ?? fallback.conducted,
    attended: primary.attended ?? fallback.attended,
    missed: primary.missed ?? fallback.missed,
  };
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

function normalizeRollNumber(value) {
  return String(value || "").trim().toUpperCase();
}

function rejectHtmlResponse(payload) {
  if (typeof payload !== "string") {
    return;
  }

  if (/^\s*<html[\s>]/i.test(payload)) {
    throw new Error("Attendance API returned HTML instead of JSON.");
  }
}

function buildApiUrl(endpoint, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null && value !== "")
  ).toString();
  const url = `${API_BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(
    /^\/+/,
    ""
  )}`;

  return query ? `${url}?${query}` : url;
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
  checkStudent,
  getAttendance,
};
