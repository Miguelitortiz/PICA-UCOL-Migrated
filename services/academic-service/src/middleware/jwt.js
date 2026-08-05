import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'pica-ucol-jwt-secret-2026';

export function jwtAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado. Inicia sesión nuevamente.' });
    }
  }

  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [user, pass] = credentials.split(':');
    const expectedUser = process.env.ADMIN_USER || 'admin';
    const expectedPass = process.env.ADMIN_PASSWORD || 'admin_pass';
    if (user === expectedUser && pass === expectedPass) {
      req.user = { id: 0, username: user, role: 'admin_general', professor_id: null };
      return next();
    }
  }

  return res.status(401).json({ error: 'Autenticación requerida. Inicia sesión en /admin/login.' });
}
