import { Router, Request, Response } from 'express';
import { register, login } from '../controllers/auth.controller';

const router = Router();

router.post('/register', register as (req: Request, res: Response) => any);
router.post('/login', login as (req: Request, res: Response) => any);

export default router;
