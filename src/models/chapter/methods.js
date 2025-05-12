/**
 * Định nghĩa các instance methods cho Chapter model
 * @param {Object} schema - Schema của Chapter model
 */
const setupMethods = (schema) => {
  /**
   * Cập nhật nội dung chapter
   * @param {string} content - Nội dung mới
   * @returns {Promise<Object>} - Chapter đã cập nhật
   */
  schema.methods.updateContent = async function(content) {
    this.content = content;
    return this.save();
  };

  /**
   * Cập nhật trạng thái chapter
   * @param {boolean} status - Trạng thái mới
   * @returns {Promise<Object>} - Chapter đã cập nhật
   */
  schema.methods.updateStatus = async function(status) {
    this.status = status;
    return this.save();
  };

  /**
   * Cập nhật thông tin audio
   * @param {string} audio - URL audio mới
   * @param {boolean} audioShow - Trạng thái hiển thị audio
   * @returns {Promise<Object>} - Chapter đã cập nhật
   */
  schema.methods.updateAudio = async function(audio, audioShow) {
    this.audio = audio;
    this.audio_show = audioShow;
    return this.save();
  };
};

module.exports = setupMethods;
