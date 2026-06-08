const {
  checkStudent,
  getAttendance,
} = require("../services/attendanceService");
const { MAIN_MENU_OPTIONS } = require("../utils/keyboard");
const { logBotEvent } = require("../utils/logger");

const PORTAL_URL = "https://sietkcai.infinityfreeapp.com/monthly_attendance.php";
const HTML_OPTIONS = {
  parse_mode: "HTML",
  disable_web_page_preview: true,
};
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

const ROLL_NUMBER_PROMPT = `🆔 <b>Enter Your Roll Number</b>

Example:
<code>23CS001</code>`;

const INVALID_MONTH_MESSAGE = `⚠️ <b>Invalid Format</b>

Please enter month as:

<code>MM, YYYY</code>

Example:

<code>06, 2025</code>`;

const API_FAILURE_MESSAGE =
  "⚠️ Unable to fetch attendance details. Please try again later.";
const INVALID_ROLL_NUMBER_MESSAGE =
  "\u26A0\uFE0F Please enter valid Roll Number";

const ATTENDANCE_SEPARATOR = "\u2501".repeat(14);
const BULLET = "\u2022";
const EMOJIS = {
  student: "\u{1F393}",
  calendar: "\u{1F4C5}",
  percentage: "\u{1F4CA}",
  overall: "\u{1F4C8}",
};

function registerAttendanceHandler(bot) {
  bot.hears(MAIN_MENU_OPTIONS.attendance, handleAttendanceMenu);

  bot.on("text", async (ctx, next) => {
    const attendanceState = ctx.session?.attendance;

    if (!attendanceState) {
      return next();
    }

    const messageText = ctx.message.text.trim();

    if (isMainMenuSelection(messageText)) {
      clearAttendanceSession(ctx);
      return next();
    }

    if (attendanceState.step === "roll_number") {
      return handleRollNumber(ctx, messageText);
    }

    if (attendanceState.step === "month") {
      return handleMonthSelection(
        ctx,
        messageText,
        attendanceState.rollNo,
        attendanceState.student
      );
    }

    clearAttendanceSession(ctx);
    return next();
  });
}

async function handleAttendanceMenu(ctx) {
  if (!ctx.session) {
    ctx.session = {};
  }

  ctx.session.attendance = {
    step: "roll_number",
  };

  logBotEvent(ctx, {
    selectedMenu: MAIN_MENU_OPTIONS.attendance,
    attendanceStep: "Roll Number",
  });

  return ctx.reply(ROLL_NUMBER_PROMPT, HTML_OPTIONS);
}

async function handleRollNumber(ctx, messageText) {
  const rollNumber = normalizeRollNumberInput(messageText);

  console.log("ROLL NUMBER USER INPUT:", rollNumber);

  if (!isValidRollNumber(rollNumber)) {
    logBotEvent(ctx, {
      action: "Invalid Roll Number",
      rollNumber: messageText,
    });
    return ctx.reply(INVALID_ROLL_NUMBER_MESSAGE);
  }

  let studentCheck;

  try {
    studentCheck = await checkStudent(rollNumber);
  } catch (error) {
    logBotEvent(ctx, {
      action: "Roll Number Check Failed",
      rollNumber,
      apiError: error?.message || error,
    });
    return ctx.reply(API_FAILURE_MESSAGE);
  }

  if (studentCheck.status !== true) {
    logBotEvent(ctx, {
      action: "Roll Number Not Found",
      rollNumber,
      apiMessage: studentCheck.message,
    });
    return ctx.reply(INVALID_ROLL_NUMBER_MESSAGE);
  }

  const student = studentCheck.student;

  ctx.session.attendance = {
    step: "month",
    rollNo: rollNumber,
    student,
  };

  logBotEvent(ctx, {
    action: "Student Found",
    rollNumber,
    studentName: student.studentName,
    attendanceStep: "Month",
  });

  return ctx.reply(buildStudentFoundMessage(student), HTML_OPTIONS);
}

async function handleMonthSelection(ctx, messageText, rollNo, student = null) {
  const selectedMonth = parseMonthSelection(messageText);

  if (!selectedMonth) {
    logBotEvent(ctx, {
      action: "Invalid Attendance Month Format",
      rollNumber: rollNo,
      monthInput: messageText,
    });
    return ctx.reply(INVALID_MONTH_MESSAGE, HTML_OPTIONS);
  }

  const { month, year } = selectedMonth;

  logBotEvent(ctx, {
    action: "Attendance Request",
    rollNumber: rollNo,
    month,
    year,
  });

  let attendance;

  try {
    attendance = await getAttendance(rollNo, month, year);
  } catch (error) {
    logBotEvent(ctx, {
      action: "Attendance Request Failed",
      rollNumber: rollNo,
      month,
      year,
      apiError: error?.message || error,
    });
    clearAttendanceSession(ctx);
    return ctx.reply(API_FAILURE_MESSAGE);
  }

  clearAttendanceSession(ctx);

  if (!attendance) {
    return ctx.reply(buildNoDataMessage(month, year), HTML_OPTIONS);
  }

  attendance = applyStudentFallback(attendance, student);

  return sendAttendanceReport(ctx, attendance);
}

async function sendAttendanceReport(ctx, attendance) {
  if (attendance.photoUrl) {
    try {
      await ctx.replyWithPhoto(attendance.photoUrl);
    } catch (error) {
      logBotEvent(ctx, {
        action: "Attendance Photo Send Failed",
        attendancePhoto: attendance.photoUrl,
        telegramError: error?.message || error?.description || error,
      });
    }
  }

  return ctx.reply(buildAttendanceMessage(attendance), HTML_OPTIONS);
}

function buildStudentFoundMessage(student) {
  return `✅ <b>Student Found</b>

👤 ${escapeHtml(student.studentName)}

Now enter month in the format:

<code>MM, YYYY</code>

Example:

<code>06, 2025</code>`;
}

function applyStudentFallback(attendance, student) {
  if (!student) {
    return attendance;
  }

  return {
    ...attendance,
    studentName:
      attendance.studentName && attendance.studentName !== "Student"
        ? attendance.studentName
        : student.studentName,
    photoUrl: attendance.photoUrl || student.photoUrl || null,
  };
}

function buildAttendanceMessage(attendance) {
  return `${EMOJIS.student} Student Attendance Report

Dear ${escapeHtml(attendance.studentName)},

"Success begins with consistency and commitment."

${EMOJIS.calendar} ${escapeHtml(attendance.monthName)} Attendance

${EMOJIS.percentage} Percentage : ${formatPercentage(
    attendance.monthly.percentage
  )}

${BULLET} Classes Conducted : ${formatCount(attendance.monthly.conducted)}
${BULLET} Classes Attended : ${formatCount(attendance.monthly.attended)}
${BULLET} Classes Missed : ${formatCount(attendance.monthly.missed)}

${ATTENDANCE_SEPARATOR}

${EMOJIS.overall} Overall Attendance

${BULLET} Percentage : ${formatPercentage(attendance.overall.percentage)}

${BULLET} Classes Conducted : ${formatCount(attendance.overall.conducted)}
${BULLET} Classes Attended : ${formatCount(attendance.overall.attended)}
${BULLET} Classes Missed : ${formatCount(attendance.overall.missed)}

${ATTENDANCE_SEPARATOR}

Keep up the good work and stay consistent.`;
}

function buildNoDataMessage(month, year) {
  return `❌ <b>Attendance Not Available</b>

In <b>${escapeHtml(getMonthName(month))}, ${escapeHtml(
    year
  )}</b>, Attendance Details not found.

Please check in the Portal also:

${PORTAL_URL}`;
}

function parseMonthSelection(messageText) {
  const match = messageText.match(/^(0[1-9]|1[0-2])\s*,\s*(\d{4})$/);

  if (!match) {
    return null;
  }

  return {
    month: match[1],
    year: match[2],
  };
}

function isValidRollNumber(rollNo) {
  return /^[A-Z0-9]{3,20}$/.test(rollNo);
}

function normalizeRollNumberInput(value) {
  return String(value || "").trim().toUpperCase();
}

function isMainMenuSelection(messageText) {
  return Object.values(MAIN_MENU_OPTIONS).includes(messageText);
}

function clearAttendanceSession(ctx) {
  if (ctx.session?.attendance) {
    delete ctx.session.attendance;
  }
}

function formatPercentage(value) {
  return value == null ? "N/A" : `${Number(value).toFixed(2)}%`;
}

function formatCount(value) {
  return value == null ? "N/A" : String(Number(value));
}

function getMonthName(month) {
  return MONTH_NAMES[Number(month) - 1] || month;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = registerAttendanceHandler;
