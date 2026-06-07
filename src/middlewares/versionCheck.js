const {
  getLatestVersion,
  saveBotUser,
  updateUserVersion,
} = require("../services/versionService");
const { logBotEvent } = require("../utils/logger");

const SEPARATOR = "\u2501".repeat(20);
const EMOJIS = {
  rocket: "\u{1F680}",
  calendar: "\u{1F5D3}\uFE0F",
  chart: "\u{1F4CA}",
  book: "\u{1F4DA}",
  memo: "\u{1F4DD}",
  openBook: "\u{1F4D6}",
  clipboard: "\u{1F4CB}",
  graduationCap: "\u{1F393}",
  sparkle: "\u2728",
};

const notificationLocks = new Set();

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

    let currentVersion = null;

    try {
      const saveUserPayload = {
        telegramUserId: user.telegramUserId,
        username: user.username,
        lastVersionSeen: latestVersion.version,
      };

      console.log(saveUserPayload);

      const savedUser = await saveBotUser(saveUserPayload);
      currentVersion = savedUser.lastVersionSeen || null;
    } catch (error) {
      logBotEvent(ctx, {
        action: "Bot User Save Failed",
        currentVersion,
        latestVersion: latestVersion.version,
        notificationSent: false,
        apiError: error?.message || error,
      });
      return next();
    }

    if (currentVersion === latestVersion.version) {
      logVersionCheck(ctx, currentVersion, latestVersion.version, false);
      return next();
    }

    const lockKey = `${user.telegramUserId}:${latestVersion.version}`;

    if (notificationLocks.has(lockKey)) {
      logBotEvent(ctx, {
        action: "Version Check",
        currentVersion,
        latestVersion: latestVersion.version,
        notificationSent: false,
        notificationSkipped: "already_in_progress",
      });
      return next();
    }

    notificationLocks.add(lockKey);

    let notificationSent = false;

    try {
      await ctx.reply(buildUpdateNotification(latestVersion));
      notificationSent = true;
      await updateUserVersion(user, latestVersion.version);
    } catch (error) {
      logBotEvent(ctx, {
        action: notificationSent
          ? "Bot User Version Update Failed"
          : "Update Notification Failed",
        currentVersion,
        latestVersion: latestVersion.version,
        notificationSent,
        apiError: notificationSent ? error?.message || error : undefined,
        telegramError: notificationSent
          ? undefined
          : error?.message || error?.description || error,
      });
    } finally {
      notificationLocks.delete(lockKey);
    }

    logVersionCheck(
      ctx,
      currentVersion,
      latestVersion.version,
      notificationSent
    );

    return next();
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

function buildUpdateNotification(latestVersion) {
  const featureLines = getFeatureLines(latestVersion).map(formatFeatureLine);
  const featureBlock = featureLines.length
    ? featureLines.join("\n\n")
    : `${EMOJIS.sparkle} Latest improvements`;

  return [
    SEPARATOR,
    "",
    `${EMOJIS.rocket} CAI BOT UPDATED`,
    "",
    "New Features Available",
    "",
    featureBlock,
    "",
    "Stay connected and explore the latest features.",
    "",
    `Happy Learning! ${EMOJIS.graduationCap}`,
    "",
    SEPARATOR,
  ].join("\n");
}

function getFeatureLines(latestVersion) {
  if (Array.isArray(latestVersion?.features) && latestVersion.features.length) {
    return latestVersion.features;
  }

  const releaseNotes = String(latestVersion?.releaseNotes || "").trim();

  if (!releaseNotes) {
    return [];
  }

  return releaseNotes
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatFeatureLine(feature) {
  const label = cleanFeatureLabel(feature);

  if (!label) {
    return `${EMOJIS.sparkle} Latest improvements`;
  }

  return `${getFeatureEmoji(label)} ${label}`;
}

function cleanFeatureLabel(feature) {
  return String(feature)
    .trim()
    .replace(/\s+added$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFeatureEmoji(feature) {
  if (/timetable/i.test(feature)) {
    return EMOJIS.calendar;
  }

  if (/attendance/i.test(feature)) {
    return EMOJIS.chart;
  }

  if (/syllabus/i.test(feature)) {
    return EMOJIS.clipboard;
  }

  if (/question|bank/i.test(feature)) {
    return EMOJIS.book;
  }

  if (/study|material/i.test(feature)) {
    return EMOJIS.openBook;
  }

  if (/internal|marks|exam|test/i.test(feature)) {
    return EMOJIS.memo;
  }

  return EMOJIS.sparkle;
}

function logVersionCheck(ctx, currentVersion, latestVersion, notificationSent) {
  logBotEvent(ctx, {
    action: "Version Check",
    currentVersion,
    latestVersion,
    notificationSent,
  });
}

module.exports = {
  buildUpdateNotification,
  createVersionCheckMiddleware,
  versionCheck: createVersionCheckMiddleware,
};
