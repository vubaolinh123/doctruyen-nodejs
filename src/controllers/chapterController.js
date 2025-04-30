const Chapter = require('../models/Chapter');
const Story = require('../models/Story');
const mongoose = require('mongoose');

exports.getAll = async (req, res) => {
  try {
    const items = await Chapter.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const item = await Chapter.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    // Validate story_id
    if (!mongoose.Types.ObjectId.isValid(req.body.story_id)) {
      return res.status(400).json({ error: 'Invalid story_id' });
    }

    // Check if story exists
    const storyExists = await Story.findById(req.body.story_id);
    if (!storyExists) {
      return res.status(400).json({ error: 'Story not found' });
    }

    // Create chapter with new model structure
    const chapterData = {
      kho_truyen_chapter_id: req.body.kho_truyen_chapter_id || 0,
      story_id: req.body.story_id,
      chapter: req.body.chapter,
      name: req.body.name,
      slug: req.body.slug || '',
      content: req.body.content || '',
      audio: req.body.audio || '',
      audio_show: Boolean(req.body.audio_show),
      show_ads: Boolean(req.body.show_ads),
      link_ref: req.body.link_ref || '',
      pass_code: req.body.pass_code || '',
      is_new: Boolean(req.body.is_new),
      status: Boolean(req.body.status)
    };

    const item = new Chapter(chapterData);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    // Prepare update data
    const updateData = {};
    
    // Only update fields that are present in request
    if (req.body.kho_truyen_chapter_id !== undefined) updateData.kho_truyen_chapter_id = req.body.kho_truyen_chapter_id;
    if (req.body.chapter !== undefined) updateData.chapter = req.body.chapter;
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.slug !== undefined) updateData.slug = req.body.slug;
    if (req.body.content !== undefined) updateData.content = req.body.content;
    if (req.body.audio !== undefined) updateData.audio = req.body.audio;
    if (req.body.audio_show !== undefined) updateData.audio_show = Boolean(req.body.audio_show);
    if (req.body.show_ads !== undefined) updateData.show_ads = Boolean(req.body.show_ads);
    if (req.body.link_ref !== undefined) updateData.link_ref = req.body.link_ref;
    if (req.body.pass_code !== undefined) updateData.pass_code = req.body.pass_code;
    if (req.body.is_new !== undefined) updateData.is_new = Boolean(req.body.is_new);
    if (req.body.status !== undefined) updateData.status = Boolean(req.body.status);
    
    const item = await Chapter.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );
    
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await Chapter.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get chapters by story ID
exports.getChaptersByStory = async (req, res) => {
  try {
    const storyId = req.params.storyId;
    
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }

    const chapters = await Chapter.find({ story_id: storyId })
      .sort({ chapter: 1 });
      
    res.json(chapters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get latest chapter by story ID
exports.getLatestChapter = async (req, res) => {
  try {
    const storyId = req.params.storyId;
    
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }

    const chapter = await Chapter.findLatestByStory(storyId);
    
    if (!chapter) {
      return res.status(404).json({ error: 'No chapters found' });
    }
      
    res.json(chapter);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};