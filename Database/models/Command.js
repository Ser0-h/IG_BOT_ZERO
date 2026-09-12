const mongoose = require('mongoose');

const commandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    usedBy: { type: String, required: true }, // igId
    threadId: { type: String },
    usedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model('Command', commandSchema);
