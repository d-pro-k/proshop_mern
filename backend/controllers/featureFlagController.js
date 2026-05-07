import asyncHandler from 'express-async-handler'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FEATURES_PATH = path.resolve(__dirname, '../features.json')

const readFeatures = async () => {
  const raw = await readFile(FEATURES_PATH, 'utf-8')
  return JSON.parse(raw)
}

const toEntry = (feature_id, feature) => ({ feature_id, ...feature })

// @desc    Get all feature flags
// @route   GET /api/feature-flags
// @access  Public
const getFeatureFlags = asyncHandler(async (req, res) => {
  const features = await readFeatures()
  const entries = Object.entries(features).map(([id, f]) => toEntry(id, f))
  res.json(entries)
})

// @desc    Get one feature flag by id
// @route   GET /api/feature-flags/:featureId
// @access  Public
const getFeatureFlag = asyncHandler(async (req, res) => {
  const features = await readFeatures()
  const feature = features[req.params.featureId]
  if (!feature) {
    res.status(404)
    throw new Error(`Feature flag '${req.params.featureId}' not found`)
  }
  res.json(toEntry(req.params.featureId, feature))
})

export { getFeatureFlags, getFeatureFlag }
