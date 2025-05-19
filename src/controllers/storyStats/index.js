const ratingController = require('./ratingController');

module.exports = {
  // Rating controllers
  rateStory: ratingController.rateStory,
  getUserRating: ratingController.getUserRating
};
