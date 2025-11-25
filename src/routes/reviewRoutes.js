const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');

const {
  getReviews,
  createReview,
  markHelpful
} = require('../controllers/reviewController');
const { upsertReaction } = require('../controllers/reviewController');

// Public: GET /api/reviews?productId=...
router.get('/', getReviews);

// Protected: POST /api/reviews  (create review)
router.post('/', verifyToken, createReview);

// Protected: POST /api/reviews/:id/helpful  (mark helpful)
router.post('/:id/helpful', verifyToken, markHelpful);

// Protected: POST /api/reviews/:id/reactions  (upsert reaction)
router.post('/:id/reactions', verifyToken, upsertReaction);

module.exports = router;