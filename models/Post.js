const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: { type: String, required: true },
    image: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Remove any existing indexes before creating the model
mongoose.connection.once('open', async () => {
    try {
        await mongoose.connection.collection('posts').dropIndexes();
        console.log('Dropped all indexes from posts collection');
    } catch (err) {
        console.log('No indexes to drop');
    }
});

module.exports = mongoose.model('Post', postSchema);