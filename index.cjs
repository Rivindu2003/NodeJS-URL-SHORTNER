// app.js
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

// Security middleware
app.use(helmet());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// URL Schema
const urlSchema = new mongoose.Schema({
    originalUrl: {
        type: String,
        required: true,
    },
    shortCode: {
        type: String,
        required: true,
        unique: true,
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    visits: {
        type: Number,
        default: 0
    }
});

// Renamed from URL to UrlModel to avoid conflict
const UrlModel = mongoose.model('Url', urlSchema);

// Generate short code
function generateShortCode() {
    return crypto.randomBytes(4).toString('hex');
}

// Improved URL validation
function isValidUrl(urlString) {
    try {
        // First, try to decode the URL to handle encoded characters
        const decodedUrl = decodeURIComponent(urlString);
        // Use global URL object with explicit reference
        const urlObject = new globalThis.URL(decodedUrl);
        // Check if the protocol is http or https
        return urlObject.protocol === 'http:' || urlObject.protocol === 'https:';
    } catch (err) {
        console.error('URL Validation Error:', err.message);
        return false;
    }
}

// Create short URL
app.post('/api/v1/shorten', async (req, res) => {
    try {
        const { url } = req.body;
        
        console.log('Received URL:', url); // Debug log

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate URL with detailed error
        if (!isValidUrl(url)) {
            return res.status(400).json({ 
                error: 'Invalid URL provided',
                details: 'URL must start with http:// or https:// and be properly formatted'
            });
        }

        // Generate unique short code
        let shortCode;
        let existingUrl;
        do {
            shortCode = generateShortCode();
            existingUrl = await UrlModel.findOne({ shortCode });
        } while (existingUrl);

        const newUrl = new UrlModel({
            originalUrl: url,
            shortCode
        });

        await newUrl.save();

        const shortUrl = `${process.env.BASE_URL}/${shortCode}`;
        res.json({ 
            shortUrl,
            originalUrl: url,
            shortCode
        });

    } catch (error) {
        console.error('Server Error:', error); // Debug log
        res.status(500).json({ 
            error: 'Server error',
            details: error.message
        });
    }
});

// Redirect to original URL
app.get('/:shortCode', async (req, res) => {
    try {
        const { shortCode } = req.params;
        const url = await UrlModel.findOne({ shortCode });

        if (!url) {
            return res.status(404).json({ error: 'URL not found' });
        }

        // Increment visit counter
        url.visits += 1;
        await url.save();

        res.redirect(url.originalUrl);

    } catch (error) {
        console.error('Redirect Error:', error); // Debug log
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));