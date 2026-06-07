const {
  checkRollNumberExists,
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

const ROLL_NUMBER_PROMPT = `━━━━━━━━━━━━━━━
<b>📊 ATTENDANCE CHECK</b>

Please enter your Roll Number.

Example:
<code>23F61Axxxx</code>
━━━━━━━━━━━━━━━`;

const MONTH_PROMPT = `━━━━━━━━━━━━━━━
<b>📅 SELECT MONTH</b>

Enter Month and Year in this format:

<code>MM, YYYY</code>

Examples:

<code>06, 2025</code>
<code>07, 2025</code>
<code>12, 2025</code>
━━━━━━━━━━━━━━━`;

const INVALID_ROLL_NUMBER_MESSAGE = `❌ Invalid Roll Number.

Roll number must be exactly 10 characters.

Example:
<code>23F61Axxxx</code>`;

const INVALID_MONTH_MESSAGE = `❌ Invalid format.

Please enter:

<code>MM, YYYY</code>

Example:

<code>06, 2025</code>`;

const API_FAILURE_MESSAGE =
  "⚠️ Unable to fetch attendance details. Please try again later.";

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
      return handleMonthSelection(ctx, messageText, attendanceState.rollNo);
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
  const rollNo = messageText.toUpperCase();

  if (!isValidRollNumber(rollNo)) {
    logBotEvent(ctx, {
      action: "Invalid Roll Number",
      rollNumber: messageText,
    });
    return ctx.reply(INVALID_ROLL_NUMBER_MESSAGE, HTML_OPTIONS);
  }

  let rollNumberExists;

  try {
    rollNumberExists = await checkRollNumberExists(rollNo);
  } catch (error) {
    logBotEvent(ctx, {
      action: "Roll Number Check Failed",
      rollNumber: rollNo,
      apiError: error?.message || error,
    });
    return ctx.reply(API_FAILURE_MESSAGE);
  }

  if (!rollNumberExists) {
    logBotEvent(ctx, {
      action: "Roll Number Not Matched",
      rollNumber: rollNo,
    });
    return ctx.reply(buildRollNotMatchedMessage(rollNo), HTML_OPTIONS);
  }

  ctx.session.attendance = {
    step: "month",
    rollNo,
  };

  logBotEvent(ctx, {
    action: "Roll Number Captured",
    rollNumber: rollNo,
    attendanceStep: "Month",
  });

  return ctx.reply(MONTH_PROMPT, HTML_OPTIONS);
}

async function handleMonthSelection(ctx, messageText, rollNo) {
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

function buildRollNotMatchedMessage(rollNo) {
  return `❌ Roll Number Not Matched

No student record found for:
<b>${escapeHtml(rollNo)}</b>

Please check your roll number and try again.`;
}

function buildNoDataMessage(month, year) {
  return `❌ Attendance Details Not Found

In <b>${escapeHtml(getMonthName(month))}, ${escapeHtml(
    year
  )}</b> attendance details not found.

You can check in the portal also.

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
  return /^[A-Z0-9]{10}$/.test(rollNo);
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
