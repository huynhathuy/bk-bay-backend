const reviewModel = require('../models/Review');
const userModel = require('../models/User');
const userUtils = require('../utils/userUtils');

// @desc  Get reviews for a product
// @route GET /api/reviews?productId=...
// @access Public
const getReviews = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    const reviews = await reviewModel.getReviewsByProductId(productId);
    // ensure username is present when possible
    const populated = await Promise.all(reviews.map(async (r) => {
      if (!r.username && r.userId) {
        const u = await userModel.getUserById(r.userId).catch(() => null);
        if (u) r.username = u.Username || u.Username || (u.Username ? u.Username : undefined);
      }
      return r;
    }));

    res.status(200).json({ success: true, reviews: populated });
  } catch (err) {
    console.error('GET REVIEWS ERROR:', err);
    res.status(500).json({ success: false, message: 'Failed to load reviews', error: err.message });
  }
};

// @desc  Create a review
// @route POST /api/reviews
// @access Private (expects verifyToken to set req.user)
const createReview = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // For current DB schema we require orderId and orderItemId to link the review via Write_review
    const { orderId, orderItemId, rating = 5, content } = req.body;
    if (!orderId || !orderItemId || !content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'orderId, orderItemId and content are required' });
    }

    const created = await reviewModel.createReview({
      orderId,
      orderItemId,
      userId: user.Id,
      rating: Number(rating) || 0,
      content: content.trim()
    });

    res.status(201).json({ success: true, message: 'Review created', review: created });
  } catch (err) {
    console.error('CREATE REVIEW ERROR:', err);
    res.status(500).json({ success: false, message: 'Failed to create review', error: err.message });
  }
};

// @desc  Mark a review as helpful
// @route POST /api/reviews/:id/helpful
// @access Private (optional, depends on routes)
// Note: this increments HelpfulCount and returns the updated review object
const markHelpful = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Review id is required' });
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

    // Use upsertReaction to insert/update a 'helpful' reaction
    const updated = await reviewModel.upsertReaction({ reviewId: id, authorId: user.Id, reactionType: 'helpful' });
    if (!updated) return res.status(404).json({ success: false, message: 'Review not found' });

    res.status(200).json({ success: true, message: 'Marked helpful', review: updated });
  } catch (err) {
    console.error('MARK HELPFUL ERROR:', err);
    res.status(500).json({ success: false, message: 'Failed to mark helpful', error: err.message });
  }
};

// Upsert a reaction (generic)
const upsertReaction = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

    const { id } = req.params; // review id
    const { type } = req.body; // e.g. 'like', 'helpful'
    if (!type) return res.status(400).json({ success: false, message: 'Reaction type required' });

    const updated = await reviewModel.upsertReaction({ reviewId: id, authorId: user.Id, reactionType: type });
    res.status(200).json({ success: true, message: 'Reaction recorded', review: updated });
  } catch (err) {
    console.error('UPSERT REACTION ERROR:', err);
    res.status(500).json({ success: false, message: 'Failed to record reaction', error: err.message });
  }
};

module.exports = {
  getReviews,
  createReview,
  markHelpful,
  upsertReaction
};