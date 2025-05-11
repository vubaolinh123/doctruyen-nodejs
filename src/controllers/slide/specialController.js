const slideService = require('../../services/slide/slideService');

exports.getActiveSlides = async (req, res) => {
  try {
    const items = await slideService.findActive();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 