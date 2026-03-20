import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const secret = process.env.JWT_SECRET || 'heritago-super-secret-key-2026';
const token = jwt.sign({ id: '339f41f0-b03e-493a-80ec-50686d180d59' }, secret, { expiresIn: '1h' });
console.log(token);
