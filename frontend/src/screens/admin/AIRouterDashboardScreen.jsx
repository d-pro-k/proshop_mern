import React, { useEffect, useMemo } from 'react'
import { Link, useLocation, useHistory } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import s from './AIRouterDashboardScreen.module.css'
import { listAssistantLogs } from '../../actions/assistantActions'
import {
  LayoutDashboardIcon,
  UsersIcon,
  PackageIcon,
  ShoppingBagIcon,
  FlagIcon,
  MessageSquareIcon,
  CpuIcon,
  CloudIcon,
  RefreshIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
} from '../../components/icons'

// Per-turn cloud costs are fractions of a cent, so show enough precision for
// sub-cent amounts (otherwise everything rounds to $0.00). $0 stays $0.00.
const fmtUsd = (n) => {
  const v = Number(n) || 0
  if (v === 0) return '$0.00'
  if (v < 0.01) return '$' + v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  return '$' + v.toFixed(2)
}
const shortId = (id) => (id ? String(id).slice(-6) : '—')
const initials = (name) =>
  !name
    ? '?'
    : name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
const fmtTime = (t) => {
  if (!t) return '—'
  const d = new Date(t)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

const RouteBadge = ({ route }) => {
  const isLocal = route === 'local'
  return (
    <span className={isLocal ? s.routeBadge + ' ' + s.routeLocal : s.routeBadge + ' ' + s.routeCloud}>
      {isLocal ? <CpuIcon size={12} /> : <CloudIcon size={12} />}
      {isLocal ? 'local' : 'cloud'}
    </span>
  )
}

const AIRouterDashboardScreen = () => {
  const location = useLocation()
  const history = useHistory()
  const dispatch = useDispatch()

  const userLogin = useSelector((state) => state.userLogin)
  const userInfo = userLogin && userLogin.userInfo

  const assistantLogList = useSelector((state) => state.assistantLogList)
  const { loading, error, logs = [] } = assistantLogList

  useEffect(() => {
    if (!userInfo || !userInfo.isAdmin) {
      history.push('/login')
      return
    }
    dispatch(listAssistantLogs())
  }, [dispatch, history, userInfo])

  const summary = useMemo(() => {
    const total = logs.length
    const local = logs.filter((l) => l.route === 'local').length
    const cloud = total - local
    const cloudSpend = logs.reduce((acc, l) => acc + (Number(l.costUsd) || 0), 0)
    // Estimated saving: private turns that would otherwise have hit the cloud,
    // priced at the observed average cloud cost-per-turn.
    const avgCloud = cloud > 0 ? cloudSpend / cloud : 0
    const estSaved = local * avgCloud
    return { total, local, cloud, cloudSpend, estSaved }
  }, [logs])

  const userName = (userInfo && userInfo.name) || 'Admin'
  const userEmail = (userInfo && userInfo.email) || 'admin@proshop.dev'

  const navCls = (path) =>
    location.pathname === path ? s.navItem + ' ' + s.navItemActive : s.navItem

  const renderContent = () => {
    if (loading) {
      return (
        <div className={s.skeletonList} aria-busy="true" aria-label="Loading logs">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={s.skeletonRow} style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      )
    }
    if (error) {
      return (
        <div className={s.errorAlert} role="alert">
          <span className={s.errorIcon}><AlertCircleIcon size={20} /></span>
          <div>
            <div className={s.errorTitle}>Failed to load AI router logs</div>
            <div className={s.errorDesc}>{error}</div>
            <button className={s.errorRetry} onClick={() => dispatch(listAssistantLogs())}>
              Try again
            </button>
          </div>
        </div>
      )
    }
    if (logs.length === 0) {
      return (
        <div className={s.empty}>
          <span className={s.emptyIcon}><MessageSquareIcon size={32} /></span>
          <div className={s.emptyTitle}>No assistant activity yet</div>
          <div className={s.emptyDesc}>
            Rows appear here once users chat with the assistant and the router logs each turn.
          </div>
        </div>
      )
    }
    return (
      <div className={s.tableWrap}>
        <table className={s.table} aria-label="AI router logs">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Message</th>
              <th>PII</th>
              <th>Route</th>
              <th>Why</th>
              <th>Model</th>
              <th>Reply</th>
              <th className={s.num}>Latency</th>
              <th className={s.num}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const isLocal = l.route === 'local'
              const pii = Array.isArray(l.piiEntities) ? l.piiEntities : []
              return (
                <tr key={l._id} className={isLocal ? s.rowLocal : s.rowCloud}>
                  <td className={s.timeCell}>{fmtTime(l.createdAt)}</td>
                  <td className={s.idCell} title={l.userId}>{shortId(l.userId)}</td>
                  <td className={s.msgCell} title={l.message}>{l.message}</td>
                  <td className={s.piiCell}>
                    {pii.length === 0 ? (
                      <span className={s.piiNone}>none</span>
                    ) : (
                      pii.map((p) => (
                        <span key={p} className={s.piiBadge}>{p}</span>
                      ))
                    )}
                  </td>
                  <td>
                    <div className={s.routeCell}>
                      <RouteBadge route={l.route} />
                      {(l.minimized || l.masked) && (
                        <div className={s.privacyBadges}>
                          {l.minimized && (
                            <span
                              className={s.privacyBadge}
                              title="Order fields minimized before the cloud saw them"
                            >
                              minimized
                            </span>
                          )}
                          {l.masked && (
                            <span
                              className={s.privacyBadge}
                              title="PII masked to tokens for the cloud, restored in your reply"
                            >
                              masked
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={s.whyCell} title={l.routeReason}>
                    {l.routeReason || '—'}
                  </td>
                  <td className={s.modelCell} title={l.model}>{l.model || '—'}</td>
                  <td className={s.replyCell} title={l.reply}>{l.reply}</td>
                  <td className={s.num}>{l.latencyMs != null ? l.latencyMs + ' ms' : '—'}</td>
                  <td className={s.num + ' ' + (isLocal ? s.costZero : s.costPaid)}>
                    {fmtUsd(isLocal ? 0 : l.costUsd)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className={s.dashboard}>
      <nav className={s.sidebar} aria-label="Admin navigation">
        <div className={s.brand}>
          <LayoutDashboardIcon size={18} /> Admin
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
          <Link to="/admin/ai-router" className={navCls('/admin/ai-router')}>
            <MessageSquareIcon size={16} /> AI Router
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
        {/* Mobile nav — shown at ≤767px when the sidebar is hidden */}
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
          <Link to="/admin/ai-router" className={location.pathname === '/admin/ai-router' ? s.mobileNavItem + ' ' + s.mobileNavItemActive : s.mobileNavItem}>
            <MessageSquareIcon size={14} /> AI Router
          </Link>
        </nav>

        <header className={s.topbar}>
          <nav className={s.breadcrumb} aria-label="Breadcrumb">
            <span>Admin</span>
            <span className={s.breadcrumbSep} aria-hidden="true">&rsaquo;</span>
            <span className={s.breadcrumbCurrent}>AI Router</span>
          </nav>
        </header>

        <main className={s.main}>
          <div className={s.pageHeader}>
            <div>
              <h1 className={s.pageTitle}>AI Router Dashboard</h1>
              <p className={s.pageSubtitle}>
                Every assistant turn, its sensitivity routing decision, model, latency and cost.
                Private (local) turns cost $0.00; cloud cost is estimated from token counts.
              </p>
            </div>
            <button
              className={s.refreshBtn}
              onClick={() => dispatch(listAssistantLogs())}
              disabled={loading}
            >
              <RefreshIcon size={14} /> Refresh
            </button>
          </div>

          <div className={s.summaryGrid}>
            <div className={s.summaryCard}>
              <div className={s.summaryLabel}>Total requests</div>
              <div className={s.summaryValue}>{summary.total}</div>
            </div>
            <div className={s.summaryCard}>
              <div className={s.summaryLabel}>Local (private)</div>
              <div className={s.summaryValue}>{summary.local}</div>
              <div className={s.summaryHint}>kept on-device · $0.00</div>
            </div>
            <div className={s.summaryCard}>
              <div className={s.summaryLabel}>Cloud (frontier)</div>
              <div className={s.summaryValue}>{summary.cloud}</div>
              <div className={s.summaryHint}>spend {fmtUsd(summary.cloudSpend)}</div>
            </div>
            <div className={s.summaryCard}>
              <div className={s.summaryLabel}>Est. saved</div>
              <div className={s.summaryValue}>{fmtUsd(summary.estSaved)}</div>
              <div className={s.summaryHint}>private turns vs cloud avg</div>
            </div>
          </div>

          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default AIRouterDashboardScreen
