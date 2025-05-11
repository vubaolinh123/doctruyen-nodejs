module.exports = function(schema) {
    schema.statics.findByStoryId = async function(storyId) {
        return this.findOne({ story_id: storyId });
    };
}; 