// src/types/express.d.ts
import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: Role['name'];
      };
    }
  }
}
