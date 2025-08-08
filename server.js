require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// MongoDB ulanish
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/music-platform', {
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('MongoDBga ulandi'))
.catch(err => console.error('MongoDB ulanish xatosi:', err));

// Model
const songSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  audioUrl: { type: String, required: true },
  coverUrl: { type: String },
  likes: { type: Number, default: 0 },
  comments: [{
    text: { type: String, required: true },
    author: { type: String, default: 'Anonim' },
    likes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const Song = mongoose.model('Song', songSchema);

// Fayl yuklash
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      const audioTypes = /mp3|wav|ogg|mpeg/;
      const ext = path.extname(file.originalname).toLowerCase();
      if (audioTypes.test(ext)) return cb(null, true);
      return cb(new Error('Faqat audio fayllar (MP3, WAV, OGG)'));
    } else if (file.fieldname === 'cover') {
      const imageTypes = /jpeg|jpg|png|gif/;
      const ext = path.extname(file.originalname).toLowerCase();
      if (imageTypes.test(ext)) return cb(null, true);
      return cb(new Error('Faqat rasm fayllar (JPEG, PNG, GIF)'));
    }
    cb(new Error('Noto\'g\'ri fayl turi'));
  },
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Routes
// Qo'shiq yuklash
app.post('/api/songs', upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, artist } = req.body;
    if (!title || !artist) throw new Error('Sarlavha va ijrochi majburiy');

    const song = new Song({
      title,
      artist,
      audioUrl: '/uploads/' + req.files.audio[0].filename,
      coverUrl: req.files.cover ? '/uploads/' + req.files.cover[0].filename : null
    });

    await song.save();
    res.json({ success: true, song });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Barcha qo'shiqlar
app.get('/api/songs', async (req, res) => {
  try {
    const songs = await Song.find().sort({ createdAt: -1 });
    res.json({ success: true, songs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Qo'shiqni ID bo'yicha olish
app.get('/api/songs/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, error: 'Qo\'shiq topilmadi' });
    }
    res.json({ success: true, song });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Qidiruv
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) throw new Error('Qidiruv so\'rovi bo\'sh');

    const songs = await Song.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { artist: { $regex: query, $options: 'i' } }
      ]
    });
    res.json({ success: true, results: songs });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Like qo'shish
app.post('/api/songs/:id/like', async (req, res) => {
  try {
    const song = await Song.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    res.json({ success: true, song });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Comment qo'shish (avvalgi kodga qo'shing)
app.post('/api/songs/:id/comments', async (req, res) => {
  try {
    const { text, author } = req.body;
    if (!text) throw new Error('Comment matni bo\'sh');

    const song = await Song.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { text, author } } },
      { new: true }
    );
    res.json({ success: true, song });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Commentga like qo'shish
app.post('/api/songs/:songId/comments/:commentId/like', async (req, res) => {
  try {
    const song = await Song.findById(req.params.songId);
    const comment = song.comments.id(req.params.commentId);
    comment.likes += 1;
    await song.save();
    res.json({ success: true, song });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// server.js faylida
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Agar API so'rovi bo'lsa, JSON qaytaramiz
  if (req.originalUrl.startsWith('/api')) {
    return res.status(500).json({ 
      success: false, 
      error: err.message || 'Server xatosi' 
    });
  }
  
  // Oddik HTML so'rovlar uchun
  res.status(500).send('<h1>Server xatosi</h1>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ${PORT}-portda ishga tushdi`));
