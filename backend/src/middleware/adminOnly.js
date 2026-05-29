export function adminOnly(req, res, next) {
  if (req.auth?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}
