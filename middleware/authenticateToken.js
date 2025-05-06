const jwt = require('jsonwebtoken');

const authenticateToken = (roles) => (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Không có token.' });
  }
  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token không hợp lệ.' });
    }
    if (roles && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }
    req.user = user;
    next();
  });
};

module.exports = authenticateToken; 