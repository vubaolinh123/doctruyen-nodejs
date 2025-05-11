const starService = require('../../services/star/starService');

exports.getByStoryId = async (req, res) => {
  try {
    const storyId = req.params.storyId;
    const item = await starService.findByStoryId(storyId);
    if (!item) return res.status(404).json({ error: 'No star rating found for this story' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 