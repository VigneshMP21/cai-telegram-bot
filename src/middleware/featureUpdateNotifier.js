const {
  createVersionCheckMiddleware,
} = require("../middlewares/versionCheck");

module.exports = {
  createFeatureUpdateNotifier: createVersionCheckMiddleware,
};
