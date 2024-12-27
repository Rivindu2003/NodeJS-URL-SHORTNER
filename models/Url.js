import mongoose from 'mongoose';

const UrlSchema = new mongoose.Schema({
  longUrl: { type: String, required: true },
  shortCode: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now }
});

const Url = mongoose.model('Url', UrlSchema);

export { Url }; // Named export
