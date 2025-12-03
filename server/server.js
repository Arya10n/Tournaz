import express from 'express';
import dotenv from 'dotenv';
import connectDB from './src/config/database.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

app.listen(PORT, () => {
  connectDB();
  console.log(`Server is listening on port ${PORT}`);
});
