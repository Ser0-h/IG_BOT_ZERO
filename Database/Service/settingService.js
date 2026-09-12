const Settings = require('../models/Settings');

async function get(key, fallback = null) {
  const doc = await Settings.findOne({ key });
  return doc ? doc.value : fallback;
}

async function set(key, value) {
  return Settings.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
}

module.exports = { get, set };
