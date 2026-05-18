import React, { useState, useMemo, useEffect } from 'react'
import { Link, useLocation, useHistory } from 'react-router-dom'
import { useSelector } from 'react-redux'
import s from './FeatureFlagsScreen.module.css'
import { useFeatures } from './hooks/useFeatures'
import {
  LayoutDashboardIcon,
  UsersIcon,
  PackageIcon,
  ShoppingBagIcon,
  FlagIcon,
  SearchIcon,
  XIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  RowsComfortableIcon,
  RowsCompactIcon,
  AlertCircleIcon,
  ArrowUpIcon,
} from '../../components/icons'

var VIEW_TABS = ['All', 'Enabled', 'Testing', 'Disabled']

// Effective status = what the badge shows for a feature given the toggle state.
// Toggle off → 'Disabled' regardless of API value. Toggle on → original status
// (preserves 'Testing'); originally-disabled features become 'Enabled' when toggled on.
function effectiveStatus(feature, toggles) {
  var on = toggles[feature.id]
  if (on === false) return 'Disabled'
  if (on === undefined) return feature.status
  return feature.status === 'Disabled' ? 'Enabled' : feature.status
}

function getViewCount(features, view, toggles) {
  if (view === 'All') return features.length
  return features.filter(function (f) { return effectiveStatus(f, toggles) === view }).length
}

function filterByView(features, view, toggles) {
  if (view === 'All') return features
  return features.filter(function (f) { return effectiveStatus(f, toggles) === view })
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(function (w) { return w[0] }).join('').slice(0, 2).toUpperCase()
}

var FeatureFlagsScreen = function () {
  var location = useLocation()
  var history = useHistory()
  var userLogin = useSelector(function (state) { return state.userLogin })
  var userInfo = userLogin && userLogin.userInfo

  // Admin guard
  useEffect(function () {
    if (!userInfo || !userInfo.isAdmin) {
      history.push('/login')
    }
  }, [userInfo, history])

  var fetchResult = useFeatures()
  var features = fetchResult.features
  var loading = fetchResult.loading
  var error = fetchResult.error

  // ?state= overrides fetch state for demo/dev
  var params = new URLSearchParams(location.search)
  var forcedState = params.get('state')

  var activeViewState = useState('All')
  var activeView = activeViewState[0]
  var setActiveView = activeViewState[1]

  var searchState = useState('')
  var search = searchState[0]
  var setSearch = searchState[1]

  var densityState = useState('comfortable')
  var density = densityState[0]
  var setDensity = densityState[1]

  var sortState = useState({ field: 'name', dir: 'asc' })
  var sort = sortState[0]
  var setSort = sortState[1]

  var togglesState = useState({})
  var toggles = togglesState[0]
  var setToggles = togglesState[1]

  var slidersState = useState({})
  var sliders = slidersState[0]
  var setSliders = slidersState[1]

  // Initialise toggles + sliders once when data arrives (don't overwrite user changes)
  useEffect(function () {
    if (features.length === 0) return
    setToggles(function (prev) {
      if (Object.keys(prev).length > 0) return prev
      return features.reduce(function (acc, f) {
        acc[f.id] = f.status !== 'Disabled'
        return acc
      }, {})
    })
    setSliders(function (prev) {
      if (Object.keys(prev).length > 0) return prev
      return features.reduce(function (acc, f) {
        acc[f.id] = f.traffic
        return acc
      }, {})
    })
  }, [features])

  var viewCounts = useMemo(function () {
    return VIEW_TABS.reduce(function (acc, v) {
      acc[v] = getViewCount(features, v, toggles)
      return acc
    }, {})
  }, [features, toggles])

  var displayed = useMemo(function () {
    var list = filterByView(features, activeView, toggles)
    var q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(function (f) {
        return f.name.toLowerCase().indexOf(q) !== -1 ||
          f.description.toLowerCase().indexOf(q) !== -1
      })
    }
    var field = sort.field
    var dir = sort.dir
    return list.slice().sort(function (a, b) {
      var va, vb
      if (field === 'status') { va = effectiveStatus(a, toggles); vb = effectiveStatus(b, toggles) }
      else if (field === 'traffic') { va = a.traffic; vb = b.traffic }
      else if (field === 'enabled') {
        va = effectiveStatus(a, toggles) !== 'Disabled' ? 1 : 0
        vb = effectiveStatus(b, toggles) !== 'Disabled' ? 1 : 0
      }
      else { va = a.name.toLowerCase(); vb = b.name.toLowerCase() }
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [features, activeView, search, sort, toggles])

  var chips = useMemo(function () {
    var c = []
    if (activeView !== 'All') {
      c.push({ key: 'view', label: 'View: ' + activeView, clear: function () { setActiveView('All') } })
    }
    if (search.trim()) {
      c.push({ key: 'search', label: '"' + search + '"', clear: function () { setSearch('') } })
    }
    return c
  }, [activeView, search])

  var isFiltered = chips.length > 0

  function clearAll() { setActiveView('All'); setSearch('') }

  function cycleSort(field) {
    setSort(function (prev) {
      if (prev.field === field) return { field: field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return { field: field, dir: 'asc' }
    })
  }

  function navCls(path) {
    return location.pathname === path ? s.navItem + ' ' + s.navItemActive : s.navItem
  }

  var userName = (userInfo && userInfo.name) || 'Admin'
  var userEmail = (userInfo && userInfo.email) || 'admin@proshop.dev'

  function renderLoading() {
    return (
      <div className={s.skeletonList}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
          return <div key={i} className={s.skeletonRow} style={{ opacity: 1 - i * 0.08 }} />
        })}
      </div>
    )
  }

  function renderError(msg) {
    return (
      <div className={s.errorAlert} role="alert">
        <span className={s.errorIcon}><AlertCircleIcon size={20} /></span>
        <div className={s.errorBody}>
          <div className={s.errorTitle}>Failed to load feature flags</div>
          <div className={s.errorDesc}>
            {msg || 'Could not reach the feature flags service. Check your connection.'}
          </div>
          <button className={s.errorRetry} onClick={function () { window.location.reload() }}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  function renderEmpty() {
    return (
      <div className={s.empty}>
        <div className={s.emptyIconWrap}>
          <span style={{ opacity: 0.3 }}><FlagIcon size={32} /></span>
        </div>
        <div className={s.emptyTitle}>
          No feature flags found
        </div>
        <div className={s.emptyDesc}>
          {isFiltered
            ? 'Try adjusting your search or filters.'
            : 'Create your first feature flag to get started.'}
        </div>
        {isFiltered && (
          <button className={s.emptyClear} onClick={clearAll}>Clear filters</button>
        )}
      </div>
    )
  }

  function renderTable() {
    return (
      <table
        className={s.table + ' ' + (density === 'compact' ? s.compact : s.comfortable)}
        aria-label="Feature flags"
      >
        <colgroup>
          <col className={s.colFeature} />
          <col className={s.colStatus} />
          <col className={s.colTraffic} />
          <col className={s.colEnabled} />
        </colgroup>
        <thead>
          <tr>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('name') }}>
                Feature
                {sort.field === 'name' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('status') }}>
                Status
                {sort.field === 'status' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('traffic') }}>
                Traffic
                {sort.field === 'traffic' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
            <th>
              <button className={s.sortHeader} onClick={function () { cycleSort('enabled') }}>
                Enabled
                {sort.field === 'enabled' && (
                  <span className={s.sortArrow} data-dir={sort.dir}><ArrowUpIcon size={11} /></span>
                )}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {displayed.map(function (feature) {
            var on = toggles[feature.id]
            var traffic = sliders[feature.id] !== undefined ? sliders[feature.id] : feature.traffic
            var status = effectiveStatus(feature, toggles)
            var isDisabled = status === 'Disabled'
            return (
              <tr key={feature.id} className={isDisabled ? s.rowDisabled : ''}>
                <td>
                  <div className={s.featureName}>{feature.name}</div>
                  <div className={s.featureDescription}>{feature.description}</div>
                  {/* Shown only when Status/Traffic columns are hidden (responsive) */}
                  <div className={s.inlineMeta}>
                    <span className={s.statusBadge + ' ' + s['status_' + status]}>
                      <span className={s.statusDot} aria-hidden="true" />
                      {status}
                    </span>
                    <div className={s.inlineSliderWrap}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={traffic}
                        onChange={function (e) {
                          var val = Number(e.target.value)
                          setSliders(function (prev) {
                            var next = Object.assign({}, prev)
                            next[feature.id] = val
                            return next
                          })
                        }}
                        className={s.inlineSlider}
                        aria-label={'Traffic for ' + feature.name}
                      />
                      <span className={s.inlineTraffic}>{traffic}%</span>
                    </div>
                  </div>
                  <div className={s.featureMeta}>
                    Modified {feature.modified}
                    {feature.dependencies.length > 0 && (
                      <span> &middot; Needs: {feature.dependencies.join(', ')}</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={s.statusBadge + ' ' + s['status_' + status]}>
                    <span className={s.statusDot} aria-hidden="true" />
                    {status}
                  </span>
                </td>
                <td className={s.sliderCell}>
                  <div className={s.sliderInline}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={traffic}
                      onChange={function (e) {
                        var val = Number(e.target.value)
                        setSliders(function (prev) {
                          var next = Object.assign({}, prev)
                          next[feature.id] = val
                          return next
                        })
                      }}
                      className={s.slider}
                      aria-label={'Traffic for ' + feature.name}
                    />
                    <span className={s.sliderValue}>{traffic}%</span>
                  </div>
                </td>
                <td className={s.toggleCell}>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={'Toggle ' + feature.name}
                    className={on ? s.toggle + ' ' + s.toggleOn : s.toggle}
                    onClick={function () {
                      setToggles(function (prev) {
                        var next = Object.assign({}, prev)
                        next[feature.id] = !prev[feature.id]
                        return next
                      })
                    }}
                  >
                    <span className={s.toggleKnob} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  function renderContent() {
    // ?state= override for dev/demo (takes precedence)
    if (forcedState === 'loading') return renderLoading()
    if (forcedState === 'error') return renderError()
    if (forcedState === 'empty') return renderEmpty()
    // Real fetch state
    if (loading) return renderLoading()
    if (error) return renderError(error)
    if (displayed.length === 0) return renderEmpty()
    return renderTable()
  }

  return (
    <div className={s.dashboard}>
      <nav className={s.sidebar} aria-label="Admin navigation">
        <div className={s.brand}>
          <LayoutDashboardIcon size={18} />
          Admin
        </div>

        <span className={s.sectionLabel}>Manage</span>
        <div className={s.navGroup}>
          <Link to="/admin/userlist" className={navCls('/admin/userlist')}>
            <UsersIcon size={16} /> Users
          </Link>
          <Link to="/admin/productlist" className={navCls('/admin/productlist')}>
            <PackageIcon size={16} /> Products
          </Link>
          <Link to="/admin/orderlist" className={navCls('/admin/orderlist')}>
            <ShoppingBagIcon size={16} /> Orders
          </Link>
        </div>

        <span className={s.sectionLabel}>Platform</span>
        <div className={s.navGroup}>
          <Link to="/admin/feature-flags" className={navCls('/admin/feature-flags')}>
            <FlagIcon size={16} /> Feature flags
          </Link>
        </div>

        <div className={s.spacer} />

        <a href="/" className={s.footerLink}>
          <ExternalLinkIcon size={14} /> View storefront
        </a>

        <div className={s.userDivider} />

        <div className={s.userWidget}>
          <span className={s.avatar} aria-hidden="true">{initials(userName)}</span>
          <div className={s.userMeta}>
            <div className={s.userName}>{userName}</div>
            <div className={s.userEmail}>{userEmail}</div>
          </div>
          <button className={s.userMenu} aria-label="User menu">
            <MoreHorizontalIcon size={16} />
          </button>
        </div>
      </nav>

      <div className={s.mainColumn}>
        {/* Mobile nav — shown at <576px when sidebar is hidden */}
        <nav className={s.mobileNav} aria-label="Admin navigation">
          <Link to="/admin/userlist" className={location.pathname === '/admin/userlist' ? s.mobileNavItem + ' ' + s.mobileNavItemActive : s.mobileNavItem}>
            <UsersIcon size={14} /> Users
          </Link>
          <Link to="/admin/productlist" className={location.pathname === '/admin/productlist' ? s.mobileNavItem + ' ' + s.mobileNavItemActive : s.mobileNavItem}>
            <PackageIcon size={14} /> Products
          </Link>
          <Link to="/admin/orderlist" className={location.pathname === '/admin/orderlist' ? s.mobileNavItem + ' ' + s.mobileNavItemActive : s.mobileNavItem}>
            <ShoppingBagIcon size={14} /> Orders
          </Link>
          <Link to="/admin/feature-flags" className={location.pathname === '/admin/feature-flags' ? s.mobileNavItem + ' ' + s.mobileNavItemActive : s.mobileNavItem}>
            <FlagIcon size={14} /> Flags
          </Link>
        </nav>

        <header className={s.topbar}>
          <nav className={s.breadcrumb} aria-label="Breadcrumb">
            <span>Admin</span>
            <span className={s.breadcrumbSep} aria-hidden="true">&rsaquo;</span>
            <span className={s.breadcrumbCurrent}>Feature flags</span>
          </nav>
        </header>

        <main className={s.main}>
          <div className={s.pageHeader}>
            <h1 className={s.pageTitle}>Feature flags</h1>
            <p className={s.pageSubtitle}>
              Manage feature rollouts and A/B tests across your storefront.
            </p>
          </div>

          <div className={s.toolbar}>
            <div className={s.toolbarMain}>
              {/* Desktop tabs */}
              <div className={s.viewTabs} role="tablist" aria-label="Filter by view">
                {VIEW_TABS.map(function (view) {
                  var isActive = activeView === view
                  return (
                    <button
                      key={view}
                      role="tab"
                      aria-selected={isActive}
                      className={isActive ? s.viewTab + ' ' + s.viewTabActive : s.viewTab}
                      onClick={function () { setActiveView(view) }}
                    >
                      {view}
                      <span className={s.viewTabCount}>{viewCounts[view] || 0}</span>
                    </button>
                  )
                })}
              </div>

              {/* Compact select — shown on tablet/mobile instead of tabs */}
              <select
                className={s.viewTabsSelect}
                value={activeView}
                onChange={function (e) { setActiveView(e.target.value) }}
                aria-label="Filter by view"
              >
                {VIEW_TABS.map(function (view) {
                  return (
                    <option key={view} value={view}>
                      {view} ({viewCounts[view] || 0})
                    </option>
                  )
                })}
              </select>

              <div className={s.toolbarActions}>
                <div className={s.searchWrap}>
                  <span className={s.searchIcon} aria-hidden="true">
                    <SearchIcon size={14} />
                  </span>
                  <input
                    type="search"
                    className={s.input}
                    placeholder="Search flags…"
                    value={search}
                    onChange={function (e) { setSearch(e.target.value) }}
                    aria-label="Search feature flags"
                  />
                  {!search && <span className={s.kbdHint}>⌘K</span>}
                  {search && (
                    <button
                      className={s.searchClear}
                      onClick={function () { setSearch('') }}
                      aria-label="Clear search"
                    >
                      <XIcon size={12} />
                    </button>
                  )}
                </div>

                <div className={s.densityToggle} role="group" aria-label="Row density">
                  <button
                    className={density === 'comfortable' ? s.densityBtn + ' ' + s.densityBtnActive : s.densityBtn}
                    onClick={function () { setDensity('comfortable') }}
                    title="Comfortable"
                    aria-pressed={density === 'comfortable'}
                  >
                    <RowsComfortableIcon size={15} />
                  </button>
                  <button
                    className={density === 'compact' ? s.densityBtn + ' ' + s.densityBtnActive : s.densityBtn}
                    onClick={function () { setDensity('compact') }}
                    title="Compact"
                    aria-pressed={density === 'compact'}
                  >
                    <RowsCompactIcon size={15} />
                  </button>
                </div>
              </div>
            </div>

            {isFiltered && (
              <div className={s.chipsRow}>
                {chips.map(function (chip) {
                  return (
                    <span key={chip.key} className={s.chip}>
                      {chip.label}
                      <button
                        className={s.chipRemove}
                        onClick={chip.clear}
                        aria-label={'Remove ' + chip.label + ' filter'}
                      >
                        <XIcon size={10} />
                      </button>
                    </span>
                  )
                })}
                <button className={s.clearAll} onClick={clearAll}>Clear all</button>
              </div>
            )}

            {isFiltered && (
              <div className={s.resultCount} aria-live="polite">
                {displayed.length} result{displayed.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default FeatureFlagsScreen
