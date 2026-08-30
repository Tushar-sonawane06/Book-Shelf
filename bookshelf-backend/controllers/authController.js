import userRepository from '../repositories/userRepository.js';
import generateToken from '../utils/generateToken.js';
import {
  SESSION_COOKIE_NAME,
  clearSessionCookieOptions,
} from '../utils/cookies.js';

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const authUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await userRepository.findByEmail(email);

    if (user && (await userRepository.matchPassword(user, password))) {
      generateToken(res, user._id, user.email, user.role);

      res.status(200).json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      });
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    // Shape, length and email format are enforced by validateBody() on the
    // route, and email arrives already trimmed and lowercased. This handler
    // only has to deal with the one rule that needs a database lookup.
    const { name, email, password } = req.body;

    const userExists = await userRepository.findByEmail(email);

    if (userExists) {
      res.status(400);
      throw new Error('Email already exists');
    }

    const user = await userRepository.create({
      name,
      email,
      password,
    });

    if (user) {
      generateToken(res, user._id, user.email, user.role);

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    next(error);
  }
};

import sessionRepository from '../repositories/sessionRepository.js';

// @desc    Logout user / clear cookie & revoke session token
// @route   POST /api/auth/logout
// @access  Public
export const logoutUser = async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    await sessionRepository.revokeSession(token);
  }

  res.cookie(SESSION_COOKIE_NAME, '', clearSessionCookieOptions());

  res.status(200).json({ message: 'Logged out successfully' });
};

// @desc    Get user profile (restore session)
// @route   GET /api/auth/me
// @access  Private
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await userRepository.findByIdWithoutPassword(req.user._id);

    if (user) {
      res.status(200).json({ user });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = async (req, res, next) => {
  try {
    const updatedUser = await userRepository.updateProfile(req.user._id, req.body);

    if (!updatedUser) {
      res.status(404);
      throw new Error('User not found');
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user password
// @route   PUT /api/auth/password
// @access  Private
export const updateUserPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await userRepository.findById(req.user._id);

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    const isMatch = await userRepository.matchPassword(user, currentPassword);
    if (!isMatch) {
      res.status(401);
      throw new Error('Current password is incorrect');
    }

    await userRepository.updatePassword(user._id, newPassword);

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};
