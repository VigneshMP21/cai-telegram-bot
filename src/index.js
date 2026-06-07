require("dotenv").config();

const express = require("express");
const { Telegraf, session } = require("telegraf");

const { registerStartCommand } = require("./commands/start");
const {
  createFeatureUpdateNotifier,
} = require("./middleware/featureUpdateNotifier");
const registerAttendanceHandler = require("./handlers/attendanceHandler");
const registerTimetableHandler = require("./handlers/timetableHandler");
const registerQuestionBankHandler = require("./handlers/questionBankHandler");
const registerBitBankHandler = require("./handlers/bitBankHandler");
const registerStudyMaterialHandler = require("./handlers/studyMaterialHandler");
const registerSyllabusHandler = require("./handlers/syllabusHandler");

const token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("BOT_TOKEN is required to start the Telegram bot.");
}

const app = express();
const PORT = process.env.PORT || 3000;
const bot = new Telegraf(token);

bot.use(session());
bot.use(createFeatureUpdateNotifier());

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

bot.catch((error, ctx) => {
  console.error("[CAI_BOT] Unhandled bot error", {
    updateId: ctx?.update?.update_id,
    error: error?.message || error,
  });
});

bot.launch(() => {
  console.log("Bot Started");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
