const User = require('../models/User');

async function findOrCreate(igId, username) {
  let user = await User.findOne({ igId });
  if (!user) {
    user = await User.create({ igId, username });
  } else if (user.username !== username) {
    user.username = username; // keep username fresh (IG allows changes)
    await user.save();
  }
  return user;
}

async function isBanned(igId) {
  const user = await User.findOne({ igId }, 'banned');
  return !!user?.banned;
}

async function setBanned(igId, banned = true) {
  return User.findOneAndUpdate({ igId }, { banned }, { new: true });
}

async function getRole(igId) {
  const user = await User.findOne({ igId }, 'role');
  return user?.role || 'user';
}

async function touchActivity(igId) {
  return User.findOneAndUpdate({ igId }, { lastActiveAt: new Date() });
}

module.exports = { findOrCreate, isBanned, setBanned, getRole, touchActivity };
