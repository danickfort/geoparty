import crypto from 'node:crypto'
import path from 'node:path'
import express from 'express'
import multer from 'multer'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    cb(null, crypto.randomBytes(8).toString('hex') + MIME_EXTENSIONS[file.mimetype])
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in MIME_EXTENSIONS),
})

export const uploadRouter = express.Router()

uploadRouter.post('/upload', (req, res, next) => {
  const password = process.env.ADMIN_PASSWORD ?? ''
  if (!password || req.headers['x-admin-password'] !== password) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
}, upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'no_image' })
    return
  }
  res.json({ url: `/uploads/${req.file.filename}` })
})
