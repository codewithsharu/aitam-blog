const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../utils/tokenUtils');

exports.protect = async (req, res, next) => {
    try {
        // Get token from cookie
        const token = req.cookies.token;

        if (!token) {
            return res.redirect('/login');
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Get user from token
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.redirect('/login');
        }

        req.user = user;
        next();
    } catch (error) {
        res.redirect('/login');
    }
};

exports.verifiedOnly = (req, res, next) => {
    if (!req.user.isVerified) {
        return res.redirect('/pending-verification');
    }
    next();
}; 