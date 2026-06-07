const { getLatestBotVersion } = require("../services/botVersionService");
const { markBotVersionSeen } = require("../services/botUserStore");
const { logBotEvent } = require("../utils/logger");

const UPDATE_MESSAGE_OPTIONS = {
  parse_mode: "HTML",
  disable_web_page_preview: true,
};

function createFeatureUpdateNotifier() {
  return async (ctx, next) => {
    if (!ctx.from?.id) {
      return next();
    }

    let latestVersion;

    try {
      latestVersion = await getLatestBotVersion();
    } catch (error) {
      logBotEvent(ctx, {
        action: "Bot Version Check Failed",
        apiError: error?.message || error,
      });
      return next();
    }

    let versionState;

    try {
      versionState = await markBotVersionSeen(
        {
          telegramUserId: ctx.from.id,
          username: ctx.from.username || ctx.from.first_name || null,
        },
        latestVersion.version
      );
    } catch (error) {
      logBotEvent(ctx, {
        action: "Bot User Version Store Failed",
        latestVersion: latestVersion.version,
        storeError: error?.message || error,
      });
      return next();
    }

    if (!versionState.shouldNotify) {
      return next();
    }

    try {
      await ctx.reply(
        buildUpdateNotification(latestVersion),
        UPDATE_MESSAGE_OPTIONS
      );

      logBotEvent(ctx, {
        action: "Bot Update Notification Sent",
        previousVersion: versionState.previousVersion,
        latestVersion: latestVersion.version,
        features: latestVersion.features,
      });
    } catch (error) {
      logBotEvent(ctx, {
        action: "Bot Update Notification Failed",
        latestVersion: latestVersion.version,
        telegramError: error?.message || error?.description || error,
      });
    }

    return next();
  };
}

function buildUpdateNotification(version) {
  const featureLines = version.features.length
    ? version.features.map(formatFeatureLine).join("\n")
    : "✨ Latest improvements";

  return `<b>🚀 CAI BOT UPDATED</b>

<b>New Features Added:</b>

${featureLines}

Explore the new features from the main menu.

Happy Learning! 🎓`;
}

function formatFeatureLine(feature) {
  const cleanedFeature = String(feature)
    .trim()
    .replace(/\s+added$/i, "");

  return `${getFeatureEmoji(cleanedFeature)} ${escapeHtml(cleanedFeature)}`;
}

function getFeatureEmoji(feature) {
  if (/timetable/i.test(feature)) {
    return "🗓️";
  }

  if (/attendance/i.test(feature)) {
    return "📊";
  }

  if (/syllabus/i.test(feature)) {
    return "📋";
  }

  if (/question|bank|material/i.test(feature)) {
    return "📚";
  }

  return "✨";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = {
  createFeatureUpdateNotifier,
};
