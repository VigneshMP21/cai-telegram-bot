require("dotenv").config();

const { Telegraf } = require("telegraf");

const { registerStartCommand } = require("./commands/start");
const registerQuestionBankHandler = require("./handlers/questionBankHandler");
const registerBitBankHandler = require("./handlers/bitBankHandler");
const registerStudyMaterialHandler = require("./handlers/studyMaterialHandler");
const registerSyllabusHandler = require("./handlers/syllabusHandler");

const token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("BOT_TOKEN is required to start the Telegram bot.");
}

const bot = new Telegraf(token);

registerStartCommand(bot);
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

bot.launch().then(() => {
  console.log("[CAI_BOT] Bot started.");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
