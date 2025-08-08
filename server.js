const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const multer = require('multer');
const app = express();

// MongoDB ulanish
mongoose.connect('mongodb+srv://refbot:refbot00@gamepaymentbot.ffcsj5v.mongodb.net/?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDBga ulandi'))
.catch(err => console.error('MongoDB ulanish xatosi:', err));

// Fayl yuklash konfiguratsiyasi
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Faqat rasm (JPEG, JPG, PNG, GIF) va video (MP4, MOV, AVI) fayllarini yuklash mumkin'));
        }
    }
});

// Post modeli
const PostSchema = new mongoose.Schema({
    title: String,
    content: String,
    media: {
        type: String,
        default: null
    },
    mediaType: {
        type: String,
        default: null
    },
    likes: { type: Number, default: 0 },
    comments: [{
        text: String,
        likes: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
// Barcha postlarni olish
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Yangi post qo'shish
app.post('/api/posts', upload.single('media'), async (req, res) => {
    try {
        const { title, content } = req.body;
        let mediaPath = null;
        let mediaType = null;

        if (req.file) {
            mediaPath = '/uploads/' + req.file.filename;
            
            const ext = path.extname(req.file.originalname).toLowerCase();
            if (['.jpeg', '.jpg', '.png', '.gif'].includes(ext)) {
                mediaType = 'image';
                
                await sharp(req.file.path)
                    .resize(800, 800, { fit: 'inside' })
                    .toFormat('jpeg', { quality: 80 })
                    .toFile(req.file.path + '.optimized.jpg');
                
                fs.unlinkSync(req.file.path);
                fs.renameSync(req.file.path + '.optimized.jpg', req.file.path);
            } else if (['.mp4', '.mov', '.avi'].includes(ext)) {
                mediaType = 'video';
            }
        }

        const post = new Post({ title, content, media: mediaPath, mediaType });
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Postga like bosish
app.post('/api/posts/:id/like', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        post.likes += 1;
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Comment qo'shish
app.post('/api/posts/:id/comments', async (req, res) => {
    try {
        const { text } = req.body;
        const post = await Post.findById(req.params.id);
        post.comments.push({ text });
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Commentga like bosish
app.post('/api/posts/:postId/comments/:commentId/like', async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        const comment = post.comments.id(req.params.commentId);
        comment.likes += 1;
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Server ishga tushirish
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT}-portda ishga tushdi`);
});