require("dotenv").config();

const express = require("express");
const { Telegraf, session } = require("telegraf");

const { registerStartCommand } = require("./commands/start");
const {
  createVersionCheckMiddleware,
} = require("./middlewares/versionCheck");
const registerAttendanceHandler = require("./handlers/attendanceHandler");
const registerTimetableHandler = require("./handlers/timetableHandler");
const registerQuestionBankHandler = require("./handlers/questionBankHandler");
const registerBitBankHandler = require("./handlers/bitBankHandler");
const registerStudyMaterialHandler = require("./handlers/studyMaterialHandler");
const registerSyllabusHandler = require("./handlers/syllabusHandler");
const registerResultsHandler = require("./handlers/resultsHandler");

const token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("BOT_TOKEN is required to start the Telegram bot.");
}

const app = express();
const PORT = process.env.PORT || 3000;
const bot = new Telegraf(token);
const POLLING_RETRY_MS = Number(process.env.TELEGRAM_POLLING_RETRY_MS || 10000);

let botStarted = false;
let launchRetryTimer = null;
let shuttingDown = false;

bot.use(session());
bot.use(createVersionCheckMiddleware());

app.get("/", (req, res) => {
  res.send("CAI Telegram Bot Running");
});

registerStartCommand(bot);
registerAttendanceHandler(bot);
registerTimetableHandler(bot);
registerQuestionBankHandler(bot);
registerBitBankHandler(bot);
registerStudyMaterialHandler(bot);
registerSyllabusHandler(bot);
registerResultsHandler(bot);

bot.catch((error, ctx) => {
  console.error("[CAI_BOT] Unhandled bot error", {
    updateId: ctx?.update?.update_id,
    error: error?.message || error,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

startBotPolling();

process.once("SIGINT", () => stopBot("SIGINT"));
process.once("SIGTERM", () => stopBot("SIGTERM"));

async function startBotPolling() {
  if (shuttingDown || botStarted) {
    return;
  }

  try {
    await bot.launch();
    botStarted = true;
    console.log("Bot Started");
  } catch (error) {
    if (isPollingConflict(error)) {
      console.error("[CAI_BOT] Telegram polling conflict, retrying", {
        retryMs: POLLING_RETRY_MS,
        telegramError: error?.description || error?.message || error,
      });
      schedulePollingRetry();
      return;
    }

    console.error("[CAI_BOT] Bot launch failed", {
      telegramError: error?.description || error?.message || error,
      response: error?.response || null,
    });
    process.exitCode = 1;
  }
}

function schedulePollingRetry() {
  if (shuttingDown || launchRetryTimer) {
    return;
  }

  launchRetryTimer = setTimeout(() => {
    launchRetryTimer = null;
    startBotPolling();
  }, POLLING_RETRY_MS);
}

function isPollingConflict(error) {
  const description = String(
    error?.description || error?.response?.description || error?.message || ""
  );

  return (
    error?.response?.error_code === 409 ||
    error?.code === 409 ||
    /409:\s*Conflict|terminated by other getUpdates/i.test(description)
  );
}

function stopBot(signal) {
  shuttingDown = true;

  if (launchRetryTimer) {
    clearTimeout(launchRetryTimer);
    launchRetryTimer = null;
  }

  if (!botStarted) {
    return;
  }

  bot.stop(signal);
}
