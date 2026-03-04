import bcrypt from 'bcryptjs';

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hashed: string) {
  return bcrypt.compare(password, hashed);
}
