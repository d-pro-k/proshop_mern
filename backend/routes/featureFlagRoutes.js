import express from 'express'
const router = express.Router()
import {
  getFeatureFlags,
  getFeatureFlag,
} from '../controllers/featureFlagController.js'

router.route('/').get(getFeatureFlags)
router.route('/:featureId').get(getFeatureFlag)

export default router
