require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const app = express();
connectDB();

app.use(express.json());
app.use(cors({
    origin: '*', // *
    credentials: true,
  }));
app.use('/api/auth', authRoutes);
app.use('/api', routes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));