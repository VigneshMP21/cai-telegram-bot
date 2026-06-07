const { getTimetable } = require("../services/timetableService");
const { MAIN_MENU_OPTIONS } = require("../utils/keyboard");
const { logBotEvent } = require("../utils/logger");

const TIMETABLE_UNAVAILABLE_MESSAGE = "❌ Timetable currently unavailable.";
const TIMETABLE_CAPTION = `<b>🗓️ CLASS TIMETABLE</b>

Stay organized.
Plan your classes efficiently and make every lecture count.`;

function registerTimetableHandler(bot) {
  bot.hears(MAIN_MENU_OPTIONS.timetable, handleTimetableRequest);
}

async function handleTimetableRequest(ctx) {
  clearAttendanceSession(ctx);

  logBotEvent(ctx, {
    selectedMenu: MAIN_MENU_OPTIONS.timetable,
    action: "Timetable Request",
  });

  let timetable;

  try {
    timetable = await getTimetable();
  } catch (error) {
    logBotEvent(ctx, {
      action: "Timetable Request Failed",
      apiError: error?.message || error,
    });
    return ctx.reply(TIMETABLE_UNAVAILABLE_MESSAGE);
  }

  if (!timetable?.imageUrl) {
    return ctx.reply(TIMETABLE_UNAVAILABLE_MESSAGE);
  }

  try {
    await ctx.replyWithPhoto(timetable.imageUrl, {
      caption: TIMETABLE_CAPTION,
      parse_mode: "HTML",
    });
  } catch (error) {
    logBotEvent(ctx, {
      action: "Timetable Photo Send Failed",
      timetableImage: timetable.imageUrl,
      telegramError: error?.message || error?.description || error,
    });
    return ctx.reply(TIMETABLE_UNAVAILABLE_MESSAGE);
  }

  logBotEvent(ctx, {
    action: "Timetable Sent",
    timetableImage: timetable.imageUrl,
  });
}

function clearAttendanceSession(ctx) {
  if (ctx.session?.attendance) {
    delete ctx.session.attendance;
  }
}

module.exports = registerTimetableHandler;
