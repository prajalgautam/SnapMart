import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import User from '../models/User.js'
import Cart from '../models/Cart.js'
import Product from '../models/Product.js'
import { sendEmail, emailIsConfigured } from '../utils/emailService.js'
import { isDatabaseConnected } from '../../config/db.js'
import { getFallbackUser } from '../utils/fallbackData.js'

const mergeGuestCartIntoUser = async (user, sessionId) => {
  if (!sessionId) {
    return
  }

  const guestCart = await Cart.findOne({ sessionId, isGuestCart: true })
  if (!guestCart) {
    return
  }

  const existingCart = await Cart.findOne({ user: user._id })

  if (existingCart) {
    const mergedItems = [...existingCart.items]

    for (const guestItem of guestCart.items) {
      const product = await Product.findById(guestItem.product)
      if (!product) {
        continue
      }

      const existingItemIndex = mergedItems.findIndex((item) => String(item.product) === String(guestItem.product))
      const nextQuantity = (existingItemIndex > -1 ? mergedItems[existingItemIndex].quantity : 0) + guestItem.quantity
      const safeQuantity = Math.min(nextQuantity, product.stock || 0)

      if (existingItemIndex > -1) {
        mergedItems[existingItemIndex].quantity = safeQuantity
      } else {
        mergedItems.push({ product: guestItem.product, quantity: safeQuantity })
      }
    }

    existingCart.items = mergedItems.filter((item) => item.quantity > 0)
    await existingCart.save()
    await guestCart.deleteOne()
    user.cart = existingCart._id
    await user.save()
    return
  }

  guestCart.user = user._id
  guestCart.sessionId = undefined
  guestCart.isGuestCart = false
  await guestCart.save()
  user.cart = guestCart._id
  await user.save()
}

export const register = async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      const fallbackUser = getFallbackUser()
      const token = jwt.sign(
        { id: fallbackUser._id, email: fallbackUser.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      )

      return res.status(201).json({
        message: 'Registration successful',
        token,
        user: { ...fallbackUser, id: fallbackUser._id },
      })
    }

    const { name, email, password, phone, address, city, sessionId } = req.body
    const normalizedEmail = String(email || '').toLowerCase().trim()

    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = new User({
      name,
      email: normalizedEmail,
      phone,
      address,
      city,
      password: hashedPassword,
      isGuest: false
    })

    await user.save()

    if (sessionId) {
      await mergeGuestCartIntoUser(user, sessionId)
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
        isGuest: user.isGuest,
        role: user.role
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

export const login = async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      const fallbackUser = getFallbackUser()
      const token = jwt.sign(
        { id: fallbackUser._id, email: fallbackUser.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      )

      return res.json({
        message: 'Login successful',
        token,
        user: { ...fallbackUser, id: fallbackUser._id },
      })
    }

    const { email, password, sessionId } = req.body
    const normalizedEmail = String(email || '').toLowerCase().trim()

    const user = await User.findOne({ email: normalizedEmail })
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    if (sessionId) {
      await mergeGuestCartIntoUser(user, sessionId)
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
        isGuest: user.isGuest,
        role: user.role
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }

    const normalizedEmail = String(email).toLowerCase().trim()
    const user = await User.findOne({ email: normalizedEmail })
    if (!user) {
      return res.status(200).json({ message: 'If that email is registered, a reset link was sent' })
    }

    const token = crypto.randomBytes(20).toString('hex')
    user.passwordResetToken = token
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000 // 1 hour
    await user.save()

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    const resetUrl = `${clientUrl}/reset-password?token=${token}`
    const subject = 'Reset your KOSHELI password'
    const text = `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`
    const html = `<p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, please ignore this email.</p>`

    await sendEmail({ to: user.email, subject, text, html })

    const responsePayload = { message: 'If that email is registered, a reset link was sent' }
    if (!emailIsConfigured()) {
      responsePayload.token = token
    }

    res.json(responsePayload)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Token and password are required' })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' })
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' })
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    })

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' })
    }

    user.password = await bcrypt.hash(password, 10)
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined

    await user.save()

    res.json({ message: 'Password has been reset successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

export const createGuestSession = async (req, res) => {
  try {
    const sessionId = req.body.sessionId || crypto.randomBytes(16).toString('hex')
    
    const guestCart = new Cart({
      sessionId,
      isGuestCart: true,
      items: [],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    })
    
    await guestCart.save()
    
    res.json({
      sessionId,
      message: 'Guest session created'
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
