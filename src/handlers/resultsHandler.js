const { MAIN_MENU_OPTIONS } = require("../utils/keyboard");
const { logBotEvent } = require("../utils/logger");

const RESULTS_URL = "http://siddharthgroup.ac.in/resultpage.html";
const RESULTS_MESSAGE = `Result is released our college official website

${RESULTS_URL}`;

function registerResultsHandler(bot) {
  bot.hears(MAIN_MENU_OPTIONS.results, handleResultsRequest);
}

async function handleResultsRequest(ctx) {
  clearAttendanceSession(ctx);

  logBotEvent(ctx, {
    selectedMenu: MAIN_MENU_OPTIONS.results,
    action: "Results Request",
  });

  return ctx.reply(RESULTS_MESSAGE, {
    disable_web_page_preview: true,
  });
}

function clearAttendanceSession(ctx) {
  if (ctx.session?.attendance) {
    delete ctx.session.attendance;
  }
}

module.exports = registerResultsHandler;
