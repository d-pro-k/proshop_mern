import { useState, useEffect, useCallback } from 'react'

function normalize(raw) {
  return {
    id: raw.feature_id,
    name: raw.name,
    description: raw.description || '',
    status: raw.status,
    traffic: raw.traffic_percentage,
    modified: raw.last_modified,
    dependencies: raw.dependencies || [],
  }
}

export function useFeatures() {
  var featuresState = useState([])
  var features = featuresState[0]
  var setFeatures = featuresState[1]

  var loadingState = useState(true)
  var loading = loadingState[0]
  var setLoading = loadingState[1]

  var errorState = useState(null)
  var error = errorState[0]
  var setError = errorState[1]

  // loadFeatures returns a cleanup function so callers can cancel an
  // in-flight request (useEffect cleanup uses this; refetch ignores it).
  var loadFeatures = useCallback(function () {
    var cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/feature-flags')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' — ' + res.statusText)
        return res.json()
      })
      .then(function (data) {
        if (!cancelled) {
          setFeatures(data.map(normalize))
          setLoading(false)
        }
      })
      .catch(function (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load feature flags')
          setLoading(false)
        }
      })

    return function () { cancelled = true }
  }, [])

  useEffect(function () {
    return loadFeatures()
  }, [loadFeatures])

  return {
    features: features,
    loading: loading,
    error: error,
    refetch: loadFeatures,
  }
}
