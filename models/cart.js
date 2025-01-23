// models/Cart.js
const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [
      {
        bookId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Book',
          required: true,
        },
        quantity: { type: Number, required: true },
      },
    ],
    status: { type: String, enum: ['pending', 'done'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
