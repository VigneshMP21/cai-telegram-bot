require("dotenv").config();

const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    "Hi 👋 Welcome to CAI Class Portal"
  );
});

bot.hears("Hi", (ctx) => {
  ctx.reply(
    "Hello 👋 How can I help you?"
  );
});

bot.launch();

console.log("Bot Started...");