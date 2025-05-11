module.exports = function(schema) {
    schema.statics.findActive = async function() {
        return this.find({ isActive: 1 }).sort('-createdAt');
    };
}; 