const Author = require('../models/Author');
const mongoose = require('mongoose');
const slugify = require('slugify');

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, ...filters } = req.query;
    const query = {};
    
    // Filter by status if provided
    if (filters.status !== undefined) {
      query.status = filters.status === 'true';
    }
    
    // Filter by name if provided
    if (filters.name) {
      query.name = { $regex: filters.name, $options: 'i' };
    }
    
    // Filter by slug if provided
    if (filters.slug) {
      query.slug = filters.slug;
    }

    const items = await Author.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Count total
    const total = await Author.countDocuments(query);
    
    res.json({
      items,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const item = await Author.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const item = await Author.findBySlug(req.params.slug);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, slug, status } = req.body;
    
    // Check if name is provided
    if (!name) {
      return res.status(400).json({ error: 'Author name is required' });
    }
    
    // Prepare data
    const authorData = {
      name,
      status: status !== undefined ? Boolean(status) : true
    };
    
    // Add slug if provided, otherwise will be auto-generated
    if (slug) {
      authorData.slug = slug;
    }
    
    const item = new Author(authorData);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const updateData = {};
    
    // Only update fields that are present in request
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.slug !== undefined) updateData.slug = req.body.slug;
    if (req.body.status !== undefined) updateData.status = Boolean(req.body.status);
    
    // If name is updated but slug is not provided, regenerate the slug
    if (req.body.name && req.body.slug === undefined) {
      updateData.slug = slugify(req.body.name, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
    }
    
    const item = await Author.findByIdAndUpdate(
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
    const item = await Author.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all active authors
exports.getActive = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const authors = await Author.findActive(parseInt(limit));
    res.json(authors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
