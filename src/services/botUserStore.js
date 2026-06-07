const fs = require("fs/promises");
const path = require("path");

const DEFAULT_STORE_PATH = path.join(process.cwd(), "data", "bot_users.json");
const STORE_PATH = process.env.BOT_USER_STORE_PATH || DEFAULT_STORE_PATH;

let writeQueue = Promise.resolve();

async function markBotVersionSeen(user, latestVersion) {
  return queueWrite(async () => {
    const users = await readUsers();
    const telegramUserId = String(user.telegramUserId);
    const now = new Date().toISOString();
    let record = users.find(
      (item) => String(item.telegram_user_id) === telegramUserId
    );

    if (!record) {
      record = {
        id: getNextId(users),
        telegram_user_id: telegramUserId,
        username: user.username || null,
        last_version_seen: null,
        created_at: now,
      };
      users.push(record);
    }

    const previousVersion = record.last_version_seen || null;
    const shouldNotify = previousVersion !== latestVersion;

    record.username = user.username || record.username || null;

    if (shouldNotify) {
      record.last_version_seen = latestVersion;
    }

    await writeUsers(users);

    return {
      shouldNotify,
      previousVersion,
      currentVersion: record.last_version_seen,
    };
  });
}

async function readUsers() {
  try {
    const content = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(content);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeUsers(users) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });

  const temporaryPath = `${STORE_PATH}.${process.pid}.tmp`;

  await fs.writeFile(temporaryPath, `${JSON.stringify(users, null, 2)}\n`);
  await fs.rename(temporaryPath, STORE_PATH);
}

function queueWrite(operation) {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.catch(() => {});
  return result;
}

function getNextId(users) {
  return (
    users.reduce((maxId, user) => {
      const id = Number(user.id);
      return Number.isFinite(id) && id > maxId ? id : maxId;
    }, 0) + 1
  );
}

module.exports = {
  markBotVersionSeen,
};
