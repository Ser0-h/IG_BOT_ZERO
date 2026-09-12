const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    igId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin', 'owner'], default: 'user' },
    banned: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
