const pool = require('../config/database');
const sql = require('mssql');
const userModel = require('./User');
const { generateId } = require('../utils/userUtils');

// Note: your DB schema stores review basic info in Review and links to orders via Write_review and Order_Item.
// Content and reactions use Replies and Reactions tables. The functions below adapt to that schema.

async function getReviewsByProductId(barcode) {
    const req = pool.request();
    req.input('barcode', sql.VarChar, barcode);

    const q = `
        SELECT R.ID as ReviewID, R.Rating, R.[Time] as CreatedAt, WR.UserID
        FROM Review R
        INNER JOIN Write_review WR ON R.ID = WR.ReviewID
        INNER JOIN Order_Item OI ON WR.Order_itemID = OI.ID
        WHERE OI.BarCode = @barcode
        ORDER BY R.[Time] DESC
    `;

    const result = await req.query(q);
    const rows = result.recordset || [];

    // For each review, fetch username, content (from Replies if exists), and helpful count (from Reactions)
    const reviews = await Promise.all(rows.map(async (r) => {
        const reviewId = r.ReviewID;
        const userId = r.UserID;

        // username
        let username;
        try {
            const u = userId ? await userModel.getUserById(userId) : null;
            username = u ? (u.Username || u.username || u.Name) : undefined;
        } catch (e) {
            username = undefined;
        }

        // content: try to find the original review content in Replies table authored by same user
        let content = undefined;
        try {
            const creq = pool.request();
            creq.input('reviewId', sql.VarChar, reviewId);
            creq.input('author', sql.VarChar, userId);
            const cres = await creq.query(`SELECT TOP 1 Content FROM Replies WHERE ReviewID = @reviewId AND Author = @author ORDER BY [Time] ASC`);
            if (cres.recordset && cres.recordset[0]) content = cres.recordset[0].Content;
        } catch (e) {
            content = undefined;
        }

        // helpfulCount: count reactions with Type = 'helpful'
        let helpfulCount = 0;
        try {
            const hreq = pool.request();
            hreq.input('reviewId', sql.VarChar, reviewId);
            const hres = await hreq.query(`SELECT COUNT(*) AS c FROM Reactions WHERE ReviewID = @reviewId AND [Type] = 'helpful'`);
            helpfulCount = (hres.recordset && hres.recordset[0]) ? Number(hres.recordset[0].c) : 0;
        } catch (e) {
            helpfulCount = 0;
        }

        return {
            id: reviewId,
            rating: r.Rating,
            userId,
            username,
            content,
            helpfulCount,
            createdAt: r.CreatedAt ? new Date(r.CreatedAt).toISOString() : undefined
        };
    }));

    return reviews;
}

async function getReviewById(reviewId) {
    const req = pool.request();
    req.input('id', sql.VarChar, reviewId);
    const res = await req.query(`
        SELECT R.ID as ReviewID, R.Rating, R.[Time] as CreatedAt, WR.UserID
        FROM Review R
        LEFT JOIN Write_review WR ON R.ID = WR.ReviewID
        WHERE R.ID = @id
    `);
    const row = res.recordset && res.recordset[0];
    if (!row) return null;

    // reuse logic from getReviews to populate content and helpful count
    const reviews = await getReviewsByProductIdForReviewId(row.ReviewID, row.UserID, row.Rating, row.CreatedAt);
    return reviews[0] || null;
}

// helper used by getReviewById
async function getReviewsByProductIdForReviewId(reviewId, userId, rating, createdAt) {
    // content
    let content;
    try {
        const creq = pool.request();
        creq.input('reviewId', sql.VarChar, reviewId);
        creq.input('author', sql.VarChar, userId);
        const cres = await creq.query(`SELECT TOP 1 Content FROM Replies WHERE ReviewID = @reviewId AND Author = @author ORDER BY [Time] ASC`);
        if (cres.recordset && cres.recordset[0]) content = cres.recordset[0].Content;
    } catch (e) {
        content = undefined;
    }

    // helpfulCount
    let helpfulCount = 0;
    try {
        const hreq = pool.request();
        hreq.input('reviewId', sql.VarChar, reviewId);
        const hres = await hreq.query(`SELECT COUNT(*) AS c FROM Reactions WHERE ReviewID = @reviewId AND [Type] = 'helpful'`);
        helpfulCount = (hres.recordset && hres.recordset[0]) ? Number(hres.recordset[0].c) : 0;
    } catch (e) {
        helpfulCount = 0;
    }

    let username;
    try {
        const u = userId ? await userModel.getUserById(userId) : null;
        username = u ? (u.Username || u.username || u.Name) : undefined;
    } catch (e) {
        username = undefined;
    }

    return [{
        id: reviewId,
        rating,
        userId,
        username,
        content,
        helpfulCount,
        createdAt: createdAt ? new Date(createdAt).toISOString() : undefined
    }];
}

const createReview = async ({ id, orderId, orderItemId, userId, rating, content }) => {
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        const reviewId = id || generateId();

        // Insert into Review
        const rreq = new sql.Request(transaction);
        rreq.input('id', sql.VarChar, reviewId);
        rreq.input('rating', sql.Int, parseInt(rating, 10) || 0);
        await rreq.query(`INSERT INTO Review (ID, Rating, [Time]) VALUES (@id, @rating, GETDATE())`);

        // Insert into Write_review to link to order and buyer
        if (!orderId || !orderItemId || !userId) {
            await transaction.rollback();
            throw new Error('orderId, orderItemId and userId are required to link review (Write_review)');
        }
        const wreq = new sql.Request(transaction);
        wreq.input('reviewId', sql.VarChar, reviewId);
        wreq.input('userId', sql.VarChar, userId);
        wreq.input('orderItemId', sql.VarChar, orderItemId);
        wreq.input('orderId', sql.VarChar, orderId);
        await wreq.query(`INSERT INTO Write_review (ReviewID, UserID, Order_itemID, OrderID) VALUES (@reviewId, @userId, @orderItemId, @orderId)`);

        // If content provided, store it as a Replies row authored by the same user (schema doesn't have Content on Review)
        if (content && content.trim()) {
            const creq = new sql.Request(transaction);
            creq.input('reviewId', sql.VarChar, reviewId);
            creq.input('content', sql.NVarChar, content.trim());
            creq.input('author', sql.VarChar, userId);
            await creq.query(`INSERT INTO Replies (ReviewID, Content, Author, [Time]) VALUES (@reviewId, @content, @author, GETDATE())`);
        }

        await transaction.commit();

        const user = userId ? await userModel.getUserById(userId) : null;
        return {
            id: reviewId,
            rating: parseInt(rating, 10) || 0,
            userId,
            username: user ? (user.Username || user.username || user.Name) : undefined,
            content: content || undefined,
            helpfulCount: 0,
            createdAt: new Date().toISOString()
        };
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
};

// Upsert reaction: prefer stored procedure usp_Reactions_Upsert if exists, otherwise MERGE fallback
const upsertReaction = async ({ reviewId, authorId, reactionType }) => {
    try {
        const req = pool.request();
        req.input('ReviewID', sql.VarChar, reviewId);
        req.input('AuthorID', sql.VarChar, authorId);
        req.input('ReactionType', sql.VarChar, reactionType);
        // Try execute stored procedure; if it fails because not exists, fallback
        try {
            await req.execute('usp_Reactions_Upsert');
        } catch (e) {
            // fallback to MERGE
            const mreq = pool.request();
            mreq.input('ReviewID', sql.VarChar, reviewId);
            mreq.input('Author', sql.VarChar, authorId);
            mreq.input('Type', sql.VarChar, reactionType);
            await mreq.query(`
                MERGE INTO Reactions AS target
                USING (SELECT @ReviewID AS ReviewID, @Author AS Author) AS source
                ON (target.ReviewID = source.ReviewID AND target.Author = source.Author)
                WHEN MATCHED THEN
                    UPDATE SET [Type] = @Type
                WHEN NOT MATCHED THEN
                    INSERT (ReviewID, [Type], Author) VALUES (@ReviewID, @Type, @Author);
            `);
        }

        // return updated helpful count and optionally review
        const hreq = pool.request();
        hreq.input('reviewId', sql.VarChar, reviewId);
        const hres = await hreq.query(`SELECT COUNT(*) AS c FROM Reactions WHERE ReviewID = @reviewId AND [Type] = 'helpful'`);
        const helpfulCount = (hres.recordset && hres.recordset[0]) ? Number(hres.recordset[0].c) : 0;

        // Return a minimal review object with helpfulCount
        const sel = pool.request();
        sel.input('id', sql.VarChar, reviewId);
        const rres = await sel.query(`SELECT ID as ReviewID, Rating, [Time] as CreatedAt FROM Review WHERE ID = @id`);
        const rrow = rres.recordset && rres.recordset[0];
        return {
            id: reviewId,
            rating: rrow ? rrow.Rating : undefined,
            helpfulCount,
            createdAt: rrow && rrow.CreatedAt ? new Date(rrow.CreatedAt).toISOString() : undefined
        };
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getReviewsByProductId,
    getReviewById,
    createReview,
    upsertReaction
};