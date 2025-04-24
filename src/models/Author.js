import mongoose from 'mongoose';

const authorSchema = new mongoose.Schema({
    name: String
  }, { timestamps: true });
  
  module.exports = mongoose.model('Author', authorSchema);