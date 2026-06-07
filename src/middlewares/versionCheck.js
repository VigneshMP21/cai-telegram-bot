const {
  getBotUser,
  getLatestVersion,
  saveBotUser,
  updateUserVersion,
} = require("../services/versionService");
const { MAIN_MENU_OPTIONS } = require("../utils/keyboard");
const { logBotEvent } = require("../utils/logger");

const SEPARATOR = "\u2501".repeat(20);
const EMOJIS = {
  rocket: "\u{1F680}",
};

function createVersionCheckMiddleware() {
  return async (ctx, next) => {
    const user = getTelegramUser(ctx);

    if (!user) {
      return next();
    }

    let latestVersion;

    try {
      latestVersion = await getLatestVersion();
    } catch (error) {
      logBotEvent(ctx, {
        action: "Version Check Failed",
        currentVersion: null,
        latestVersion: null,
        notificationSent: false,
        apiError: error?.message || error,
      });
      return next();
    }

    let currentVersion = "";
    const latestVersionValue = String(latestVersion.version || "").trim();

    try {
      const saveUserPayload = {
        telegramUserId: user.telegramUserId,
        username: user.username,
      };

      console.log(saveUserPayload);

      await saveBotUser(saveUserPayload);

      const userData = await getBotUser(saveUserPayload);

      console.log("CURRENT USER DATA");
      console.log(userData);

      currentVersion = String(userData.lastVersionSeen || "").trim();

      console.log("CURRENT VERSION");
      console.log(currentVersion);
      console.log("LATEST VERSION");
      console.log(latestVersionValue);
    } catch (error) {
      logBotEvent(ctx, {
        action: "Bot User Save Failed",
        currentVersion,
        latestVersion: latestVersionValue,
        notificationSent: false,
        apiError: error?.message || error,
      });
      return next();
    }

    const versionMismatch = currentVersion !== latestVersionValue;
    const menuRefreshed = hasRefreshedMenu(ctx, latestVersionValue);
    let versionActivated = false;
    let notificationNeeded = versionMismatch && !menuRefreshed;

    logVersionDecision({
      currentVersion,
      latestVersion: latestVersionValue,
      menuRefreshed,
      notificationNeeded,
      versionActivated,
    });

    if (!versionMismatch) {
      clearMenuRefresh(ctx, latestVersionValue);
      logVersionCheck(ctx, currentVersion, latestVersionValue, false, {
        menuRefreshed,
        notificationNeeded,
        versionActivated,
      });
      return next();
    }

    if (isStartCommand(ctx)) {
      await next();
      markMenuRefreshed(ctx, latestVersionValue);
      notificationNeeded = false;
      logBotEvent(ctx, {
        action: "Menu Refreshed For Version",
        currentVersion,
        latestVersion: latestVersionValue,
        menuRefreshed: true,
        notificationNeeded,
        versionActivated,
        notificationSent: false,
      });
      logVersionDecision({
        currentVersion,
        latestVersion: latestVersionValue,
        menuRefreshed: true,
        notificationNeeded,
        versionActivated,
      });
      logVersionCheck(ctx, currentVersion, latestVersionValue, false, {
        menuRefreshed: true,
        notificationNeeded,
        versionActivated,
      });
      return;
    }

    if (menuRefreshed && isFeatureInteraction(ctx)) {
      await next();
      versionActivated = await markVersionCompleted(
        ctx,
        user,
        currentVersion,
        latestVersionValue
      );
      logVersionDecision({
        currentVersion,
        latestVersion: latestVersionValue,
        menuRefreshed,
        notificationNeeded: !versionActivated,
        versionActivated,
      });
      return;
    }

    if (menuRefreshed) {
      logVersionCheck(ctx, currentVersion, latestVersionValue, false, {
        menuRefreshed,
        notificationNeeded,
        versionActivated,
      });
      return next();
    }

    let notificationSent = false;

    await answerCallback(ctx);

    try {
      await ctx.reply(buildUpdateNotification(latestVersion));
      notificationSent = true;
    } catch (error) {
      logBotEvent(ctx, {
        action: "Update Notification Failed",
        currentVersion,
        latestVersion: latestVersionValue,
        menuRefreshed,
        notificationNeeded,
        versionActivated,
        notificationSent,
        telegramError: error?.message || error?.description || error,
      });
    }

    logVersionCheck(
      ctx,
      currentVersion,
      latestVersionValue,
      notificationSent,
      {
        menuRefreshed,
        notificationNeeded,
        versionActivated,
      }
    );

    return;
  };
}

function getTelegramUser(ctx) {
  const from = ctx?.from;

  if (!from?.id) {
    return null;
  }

  return {
    telegramUserId: from.id,
    username: from.username || from.first_name || null,
    firstName: from.first_name || null,
    lastName: from.last_name || null,
  };
}

function isStartCommand(ctx) {
  return /^\/start(?:\s|$)/.test(ctx?.message?.text?.trim() || "");
}

function isFeatureInteraction(ctx) {
  const messageText = ctx?.message?.text?.trim();

  if (messageText && Object.values(MAIN_MENU_OPTIONS).includes(messageText)) {
    return true;
  }

  return Boolean(ctx?.callbackQuery?.data);
}

function markMenuRefreshed(ctx, latestVersion) {
  if (!ctx.session) {
    ctx.session = {};
  }

  ctx.session.menuRefreshed = true;
  ctx.session.menuRefreshedVersion = latestVersion;
  ctx.session.menuRefreshedAt = new Date().toISOString();
}

function hasRefreshedMenu(ctx, latestVersion) {
  return (
    ctx.session?.menuRefreshed === true &&
    ctx.session?.menuRefreshedVersion === latestVersion
  );
}

function clearMenuRefresh(ctx, latestVersion) {
  if (ctx.session?.menuRefreshedVersion === latestVersion) {
    delete ctx.session.menuRefreshed;
    delete ctx.session.menuRefreshedVersion;
    delete ctx.session.menuRefreshedAt;
  }
}

async function markVersionCompleted(ctx, user, currentVersion, latestVersion) {
  const updatePayload = {
    telegram_user_id: String(user.telegramUserId),
    version: latestVersion,
  };

  console.log("UPDATING VERSION", updatePayload);

  try {
    const updateResponse = await updateUserVersion(user, latestVersion);
    console.log("VERSION UPDATE RESPONSE");
    console.log(updateResponse);
    console.log("VERSION UPDATED SUCCESSFULLY");

    const refreshedUser = await getBotUser({
      telegramUserId: user.telegramUserId,
      username: user.username,
    });
    console.log("CURRENT USER DATA");
    console.log(refreshedUser);

    const refreshedVersion = String(refreshedUser.lastVersionSeen || "").trim();
    const versionActivated = refreshedVersion === latestVersion;

    console.log("CURRENT VERSION");
    console.log(refreshedVersion);
    console.log("LATEST VERSION");
    console.log(latestVersion);
    console.log({
      currentVersion: refreshedVersion,
      latestVersion,
      notificationNeeded: refreshedVersion !== latestVersion,
      versionActivated,
    });

    if (!versionActivated) {
      logBotEvent(ctx, {
        action: "Bot User Version Verification Failed",
        currentVersion: refreshedVersion,
        previousVersion: currentVersion,
        latestVersion,
        menuRefreshed: true,
        notificationNeeded: true,
        versionActivated: false,
        notificationSent: false,
      });
      return false;
    }

    clearMenuRefresh(ctx, latestVersion);
    logBotEvent(ctx, {
      action: "User Version Updated After Feature Access",
      currentVersion: refreshedVersion,
      previousVersion: currentVersion,
      latestVersion,
      menuRefreshed: true,
      notificationNeeded: false,
      versionActivated: true,
      notificationSent: false,
    });
    return true;
  } catch (error) {
    logBotEvent(ctx, {
      action: "Bot User Version Update Failed",
      currentVersion,
      latestVersion,
      menuRefreshed: true,
      notificationNeeded: true,
      versionActivated: false,
      notificationSent: false,
      apiError: error?.message || error,
    });
    return false;
  }
}

async function answerCallback(ctx) {
  if (!ctx.callbackQuery) {
    return;
  }

  try {
    await ctx.answerCbQuery();
  } catch (error) {
    logBotEvent(ctx, {
      action: "Version Mismatch Callback Answer Failed",
      telegramError: error?.message || error?.description || error,
    });
  }
}

function buildUpdateNotification() {
  return [
    SEPARATOR,
    "",
    `${EMOJIS.rocket} CAI BOT UPDATED`,
    "",
    "New Features Added",
    "",
    "Please run:",
    "",
    "/start",
    "",
    "to refresh your menu.",
    "",
    SEPARATOR,
  ].join("\n");
}

function logVersionDecision(details) {
  console.log(details);
}

function logVersionCheck(
  ctx,
  currentVersion,
  latestVersion,
  notificationSent,
  details = {}
) {
  logBotEvent(ctx, {
    action: "Version Check",
    currentVersion,
    latestVersion,
    ...details,
    notificationSent,
  });
}

module.exports = {
  buildUpdateNotification,
  createVersionCheckMiddleware,
  versionCheck: createVersionCheckMiddleware,
};
