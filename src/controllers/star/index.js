const baseController = require('./baseController');
const specialController = require('./specialController');

module.exports = {
  ...baseController,
  ...specialController
}; 