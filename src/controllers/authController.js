const Customer = require('../models/Customer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existing = await Customer.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const customer = new Customer({ email, password: hashed, name });
    await customer.save();

    const token = jwt.sign(
      { id: customer._id, email: customer.email, role: customer.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const customer = await Customer.findOne({ email });
    if (!customer) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: customer._id, email: customer.email, role: customer.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.oath = async (req, res) => {
  try {
    const { email, name, avatar, accountType } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    let customer = await Customer.findOne({ email });
    if (!customer) {
      customer = new Customer({
        email,
        name,
        avatar,
        accountType,
        isActive: true
      });
      await customer.save();
    }

    res.json({ success: true, user: customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const customer = await Customer.findById(decoded.id);

    if (!customer) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      name: customer.name,
      email: customer.email,
      avatar: customer.avatar,
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};