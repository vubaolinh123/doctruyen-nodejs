const Category = require('../models/Category');
const mongoose = require('mongoose');
const slugify = require('slugify');

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'createdAt', order = 'desc', ...filters } = req.query;
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

    // Get all matching categories
    let items = await Category.find(query).populate('stories');

    // Format response and add comicCount
    const formattedItems = items.map(item => {
      const itemObj = item.toObject();
      itemObj.comicCount = item.stories || 0;
      delete itemObj.stories;
      return itemObj;
    });
    
    // Sort by specified field
    if (sort === 'comicCount') {
      // Sort by comic count
      formattedItems.sort((a, b) => {
        const countA = a.comicCount || 0;
        const countB = b.comicCount || 0;
        return order === 'asc' ? countA - countB : countB - countA;
      });
    } else {
      // Standard sort by other fields
      const sortOrder = order === 'asc' ? 1 : -1;
      const sortField = sort;

      formattedItems.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -1 * sortOrder;
        if (a[sortField] > b[sortField]) return 1 * sortOrder;
        return 0;
      });
    }
    
    // Count total
    const total = formattedItems.length;
    
    // Apply pagination after sorting
    const startIndex = (page - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedItems = formattedItems.slice(startIndex, endIndex);
    
    res.json({
      items: paginatedItems,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const item = await Category.findById(req.params.id).populate('stories');
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    const response = item.toObject();
    response.comicCount = item.stories || 0;
    delete response.stories;
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const item = await Category.findOne({ 
      slug: req.params.slug,
      status: true
    }).populate('stories');
    
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    const response = item.toObject();
    response.comicCount = item.stories || 0;
    delete response.stories;
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, slug, description, status } = req.body;
    
    // Check if name is provided
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Prepare data
    const categoryData = {
      name,
      description: description || '',
      status: status !== undefined ? Boolean(status) : true
    };
    
    // Add slug if provided, otherwise will be auto-generated
    if (slug) {
      categoryData.slug = slug;
    }
    
    const item = new Category(categoryData);
    await item.save();
    
    // Get story count
    await item.populate('stories');
    const response = item.toObject();
    response.comicCount = item.stories || 0;
    delete response.stories;
    
    res.status(201).json(response);
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
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.status !== undefined) updateData.status = Boolean(req.body.status);
    
    // If name is updated but slug is not provided, regenerate the slug
    if (req.body.name && req.body.slug === undefined) {
      updateData.slug = slugify(req.body.name, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
    }
    
    const item = await Category.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    ).populate('stories');
    
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    const response = item.toObject();
    response.comicCount = item.stories || 0;
    delete response.stories;
    
    res.json(response);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await Category.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all active categories
exports.getActive = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const categories = await Category.findActive(parseInt(limit)).populate('stories');
    
    const formattedCategories = categories.map(category => {
      const catObj = category.toObject();
      catObj.comicCount = category.stories || 0;
      delete catObj.stories;
      return catObj;
    });
    
    res.json(formattedCategories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};