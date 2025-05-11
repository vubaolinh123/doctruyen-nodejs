const Star = require('../../models/Star');

class StarService {
    async findAll(query = {}, options = {}) {
        const { 
            page = 1, 
            limit = 10, 
            sort = '-createdAt',
            story_id 
        } = options;

        const filter = { ...query };
        if (story_id) filter.story_id = story_id;

        return Star.find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
    }

    async findById(id) {
        return Star.findById(id);
    }

    async create(data) {
        const star = new Star(data);
        return star.save();
    }

    async update(id, data) {
        return Star.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return Star.findByIdAndDelete(id);
    }

    // Special methods
    async findByStoryId(storyId) {
        return Star.findByStoryId(storyId);
    }
}

module.exports = new StarService(); 