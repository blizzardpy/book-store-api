const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Book = require('./models/Book');
const User = require('./models/User');
const Cart = require('./models/Cart');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
mongoose
  .connect('mongodb://127.0.0.1:27017/bookDB')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// JWT Secret
const JWT_SECRET = 'your_jwt_secret';

// User Routes
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: '1h',
    });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authentication Middleware
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Book Routes
app.post('/api/books', authenticate, async (req, res) => {
  try {
    const book = new Book({ ...req.body, userId: req.user.userId });
    await book.save();
    res.status(201).json(book);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/books/:id', authenticate, async (req, res) => {
  try {
    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!book) {
      return res
        .status(404)
        .json({ message: 'Book not found or not owned by user' });
    }
    res.json(book);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/books/:id', authenticate, async (req, res) => {
  try {
    const book = await Book.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });
    if (!book) {
      return res
        .status(404)
        .json({ message: 'Book not found or not owned by user' });
    }
    res.json({ message: 'Book deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mybooks', authenticate, async (req, res) => {
  try {
    const books = await Book.find({ userId: req.user.userId });
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find({});
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cart Routes
app.get('/api/cart', authenticate, async (req, res) => {
  try {
    let cart = await Cart.findOne({
      userId: req.user.userId,
      status: 'pending',
    }).populate('items.bookId');
    if (!cart) {
      cart = new Cart({ userId: req.user.userId, items: [] });
      await cart.save();
    }
    const total = cart.items.reduce(
      (sum, item) => sum + item.bookId.price * item.quantity,
      0
    );
    res.json({ cart, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cart', authenticate, async (req, res) => {
  try {
    const { bookId, quantity } = req.body;
    let cart = await Cart.findOne({
      userId: req.user.userId,
      status: 'pending',
    });
    if (!cart) {
      cart = new Cart({ userId: req.user.userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.bookId.toString() === bookId
    );
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ bookId, quantity });
    }
    await cart.save();
    res.status(201).json(cart);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/cart/checkout', authenticate, async (req, res) => {
  try {
    let cart = await Cart.findOne({
      userId: req.user.userId,
      status: 'pending',
    });
    if (!cart) {
      return res.status(400).json({ message: 'No pending cart to checkout' });
    }
    cart.status = 'done';
    await cart.save();
    res.json({ message: 'Cart checked out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
