const Slide = require('../../models/slide');

class SlideService {
    async findAll(query = {}, options = {}) {
        const { 
            page = 1, 
            limit = 10, 
            sort = '-createdAt',
            isActive,
            search = '' 
        } = options;

        const filter = { ...query };
        if (isActive !== undefined) filter.isActive = isActive;
        if (search) filter.picture = { $regex: search, $options: 'i' };

        return Slide.find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
    }

    async findById(id) {
        return Slide.findById(id);
    }

    async create(data) {
        const slide = new Slide(data);
        return slide.save();
    }

    async update(id, data) {
        return Slide.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return Slide.findByIdAndDelete(id);
    }

    // Special methods
    async findActive() {
        return Slide.findActive();
    }
}

module.exports = new SlideService(); 