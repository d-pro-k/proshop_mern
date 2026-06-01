import express from 'express'
const router = express.Router()
import {
  getFeatureFlags,
  getFeatureFlag,
} from '../controllers/featureFlagController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

router.route('/').get(protect, admin, getFeatureFlags)
router.route('/:featureId').get(protect, admin, getFeatureFlag)

export default router
