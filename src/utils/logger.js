function logBotEvent(ctx, details = {}) {
  const from = ctx?.from || {};

  console.log(
    "[CAI_BOT]",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      userId: from.id || "unknown",
      username: from.username ? `@${from.username}` : from.first_name || "unknown",
      ...details,
    })
  );
}

module.exports = {
  logBotEvent,
};
