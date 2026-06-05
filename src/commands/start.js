const { buildMainMenu } = require("../utils/keyboard");
const { logBotEvent } = require("../utils/logger");

const WELCOME_MESSAGE =
  "🎓 Welcome to CAI Class Portal\n\nPlease choose an option:";

function registerStartCommand(bot) {
  bot.start(async (ctx) => {
    logBotEvent(ctx, { command: "/start" });
    await ctx.reply(WELCOME_MESSAGE, buildMainMenu());
  });

  bot.hears(/^hi$/i, async (ctx) => {
    logBotEvent(ctx, { message: "Hi" });
    await ctx.reply("Hello 👋\n\nPlease choose an option:", buildMainMenu());
  });
}

module.exports = {
  registerStartCommand,
};
