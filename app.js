const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const Post = require('./models/Post');
const User = require('./models/User');
const moment = require('moment');
const fs = require('fs');
const { protect, verifiedOnly } = require('./middleware/auth');
const { generateToken, JWT_SECRET } = require('./utils/tokenUtils');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('Connected to MongoDB');
    // Clear any existing data and indexes
    try {

    } catch (err) {
        // Collection might not exist yet, which is fine
        console.log('No posts collection to clear');
    }
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session configuration
app.use(session({
    secret: 'your-secret-key', // Change this to a secure secret in production
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Make moment available in EJS templates
app.locals.moment = moment;

// Update cookie settings for token
app.use(require('cookie-parser')());

// Routes
app.get('/', async (req, res) => {
    try {
        const posts = await Post.find().populate('author').sort({ createdAt: -1 });
        let user = null;

        // Check for token
        const token = req.cookies.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                user = await User.findById(decoded.id);
            } catch (err) {
                // Token invalid - clear it
                res.clearCookie('token');
            }
        }

        res.render('posts', { posts, user, moment });
    } catch (error) {
        res.status(500).send('Error fetching posts');
    }
});

// Registration routes
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', upload.single('profilePic'), async (req, res) => {
    try {
        // Log the request body to debug
        console.log('Registration request:', req.body);
        
        const profilePicPath = '/uploads/' + req.file.filename;
        
        const user = new User({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            role: req.body.role,
            profilePic: profilePicPath,
            isVerified: false // Default to unverified
        });

        await user.save();
        
        // Generate token
        const token = generateToken(user._id);

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        res.redirect('/pending-verification');
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).send('Error registering user: ' + error.message);
    }
});

// Post creation routes
app.get('/create-post', protect, verifiedOnly, async (req, res) => {
    try {
        res.render('create-post', { user: req.user });
    } catch (error) {
        res.status(500).send('Error loading create post page');
    }
});

app.post('/create-post', protect, verifiedOnly, upload.single('image'), async (req, res) => {
    try {
        const newPost = new Post({
            author: req.user._id,
            content: req.body.content,
            image: req.file ? '/uploads/' + req.file.filename : undefined
        });

        await newPost.save();
        res.redirect('/');
    } catch (error) {
        res.status(500).send('Error creating post: ' + error.message);
    }
});

// Logout route
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    req.session.destroy();
    res.redirect('/');
});

// Profile routes
app.get('/profile', protect, async (req, res) => {
    res.render('profile', { user: req.user, moment });
});

app.post('/profile/update', protect, upload.single('profilePic'), async (req, res) => {
    try {
        const updates = {
            name: req.body.name,
            role: req.body.role
        };

        if (req.file) {
            updates.profilePic = '/uploads/' + req.file.filename;
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true }
        );

        res.redirect('/profile');
    } catch (error) {
        res.status(500).send('Error updating profile: ' + error.message);
    }
});

// Login routes
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('login', { error: 'Invalid email or password' });
        }

        // Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.render('login', { error: 'Invalid email or password' });
        }

        // Generate token
        const token = generateToken(user._id);

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        // Set session
        req.session.userId = user._id;

        res.redirect('/');
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { error: 'Error logging in' });
    }
});

app.listen(process.env.PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${process.env.PORT}`);
}); 