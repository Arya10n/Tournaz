import express from 'express';
import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './src/routes/authRoutes.js';
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  connectDB();
  console.log(`Server is listening on port ${PORT}`);
});
