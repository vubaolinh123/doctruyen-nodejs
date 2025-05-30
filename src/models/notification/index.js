const mongoose = require('mongoose');
const notificationSchema = require('./schema');
const setupMethods = require('./methods');
const setupHooks = require('./hooks');

// Apply methods and hooks to schema
setupMethods(notificationSchema);
setupHooks(notificationSchema);

// Create and export the model
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
