import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod';

export function startGateway() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware para log
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'gateway' });
  });

  // Middleware de autenticação
  app.use((req, res, next) => {
    // Rotas públicas (não precisam de autenticação)
    const publicRoutes = ['/auth/register', '/auth/login', '/auth/login/pubkey'];
    
    if (publicRoutes.includes(req.path)) {
      return next();
    }

    // Verificar token para rotas privadas
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      (req as any).user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido' });
    }
  });

  // Proxy para Auth Service
  app.use('/auth', createProxyMiddleware({
    target: 'http://auth-service:3001',
    changeOrigin: true,
    pathRewrite: { '^/auth': '' }
  }));

  // Rota padrão
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Gateway Service rodando na porta ${PORT}`);
    console.log(`📞 Auth Service: http://auth-service:3001`);
  });
}