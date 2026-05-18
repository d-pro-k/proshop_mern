import React, { useEffect } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import s from './HomeScreen.module.css'
import ProductCard from './ProductCard'
import ProductCarousel from './ProductCarousel'
import Paginate from '../../components/Paginate'
import Meta from '../../components/Meta'
import { listProducts, listTopProducts } from '../../actions/productActions'
import { AlertCircleIcon, ShoppingBagIcon } from '../../components/icons'

/* HomeScreen — storefront entry point.
 *
 * Routes handled (all via the same component, derived from useParams + useLocation):
 *   /                                        → default mode (Carousel + Latest Products grid)
 *   /page/:pageNumber                        → paginated default
 *   /search/:keyword                         → search results (Carousel hidden, h1 reflects keyword)
 *   /search/:keyword/page/:pageNumber        → paginated search
 *
 * Data comes from existing Redux actions (no API change for M4):
 *   listProducts(keyword, pageNumber) → state.productList
 *   listTopProducts()                 → state.productTopRated (only fetched in default mode)
 *
 * `?state=loading|error|empty|empty-search` URL override forces the visible state
 * regardless of real Redux fetch result — used for screenshots and visual QA.
 */

var HomeScreen = function () {
  var params = useParams()
  var keyword = params.keyword
  var pageNumber = Number(params.pageNumber) || 1

  var location = useLocation()
  var query = new URLSearchParams(location.search)
  var forcedState = query.get('state')

  var dispatch = useDispatch()

  var productList = useSelector(function (state) { return state.productList })
  var loading = productList ? productList.loading : false
  var error = productList ? productList.error : null
  var reduxProducts = (productList && productList.products) || []
  var pages = (productList && productList.pages) || 1
  var page = (productList && productList.page) || 1

  var productTopRated = useSelector(function (state) { return state.productTopRated })
  var loadingTop = productTopRated ? productTopRated.loading : false
  var errorTop = productTopRated ? productTopRated.error : null
  var reduxTopProducts = (productTopRated && productTopRated.products) || []

  useEffect(function () {
    dispatch(listProducts(keyword, pageNumber))
    if (!keyword) {
      dispatch(listTopProducts())
    }
  }, [dispatch, keyword, pageNumber])

  var products = reduxProducts
  var topProducts = reduxTopProducts

  // ?state= URL override — forces the visible state for demo/screenshot purposes.
  // Redux still fetches in the background; these flags just shape what the user sees.
  if (forcedState === 'loading') {
    loading = true
    products = []
    topProducts = []
  } else if (forcedState === 'error') {
    error = 'Network request failed (demo)'
    products = []
  } else if (forcedState === 'empty') {
    products = []
  } else if (forcedState === 'empty-search') {
    products = []
  }

  // In search mode, forcedState 'empty-search' overrides keyword detection
  var isSearchMode = !!keyword || forcedState === 'empty-search'
  var displayKeyword = keyword || (forcedState === 'empty-search' ? 'example' : '')

  function renderContent() {
    if (loading) return renderSkeleton()
    if (error) return renderError(error)
    if (products.length === 0) {
      return isSearchMode ? renderEmptySearch(displayKeyword) : renderEmpty()
    }
    return renderGrid(products)
  }

  function renderSkeleton() {
    return (
      <div className={s.grid} aria-busy='true' aria-label='Loading products'>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
          return (
            <div key={i} className={s.skeletonCard}>
              <div className={s.skeletonImage} />
              <div className={s.skeletonBody}>
                <div className={s.skeletonLine} />
                <div className={s.skeletonLine + ' ' + s.skeletonLineShort} />
                <div className={s.skeletonLine + ' ' + s.skeletonLineMid} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderError(msg) {
    return (
      <div className={s.errorAlert} role='alert'>
        <span className={s.errorIcon}><AlertCircleIcon size={20} /></span>
        <div className={s.errorBody}>
          <div className={s.errorTitle}>Failed to load products</div>
          <div className={s.errorDesc}>
            {msg || 'Could not reach the products service. Check your connection.'}
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
        <div className={s.emptyIcon} aria-hidden='true'>
          <ShoppingBagIcon size={40} />
        </div>
        <div className={s.emptyTitle}>No products yet</div>
        <div className={s.emptyDesc}>Products will appear here as they’re added.</div>
      </div>
    )
  }

  function renderEmptySearch(kw) {
    return (
      <div className={s.empty}>
        <div className={s.emptyIcon} aria-hidden='true'>
          <ShoppingBagIcon size={40} />
        </div>
        <div className={s.emptyTitle}>No products match “{kw}”</div>
        <div className={s.emptyDesc}>Try a different search term.</div>
        <Link to='/' className={s.emptyAction}>Browse all products</Link>
      </div>
    )
  }

  function renderGrid(items) {
    return (
      <div className={s.grid}>
        {items.map(function (p) {
          return <ProductCard key={p._id} product={p} />
        })}
      </div>
    )
  }

  var title = isSearchMode ? ('Results for “' + displayKeyword + '”') : 'Latest Products'

  return (
    <main className={s.page}>
      <Meta />

      {isSearchMode && (
        <Link to='/' className={s.goBack}>
          Go back
        </Link>
      )}

      {!isSearchMode && (
        <section className={s.carouselSection} aria-label='Top rated products'>
          <ProductCarousel
            products={topProducts}
            loading={loadingTop && !forcedState}
            error={errorTop}
          />
        </section>
      )}

      <header className={s.sectionHeader}>
        <h1 className={s.title}>{title}</h1>
        {isSearchMode && (
          <p className={s.resultCount} aria-live='polite'>
            {products.length} {products.length === 1 ? 'product' : 'products'} found
          </p>
        )}
      </header>

      {renderContent()}

      {pages > 1 && products.length > 0 && (
        <div className={s.paginationWrap}>
          <Paginate pages={pages} page={page} keyword={keyword ? keyword : ''} />
        </div>
      )}
    </main>
  )
}

export default HomeScreen
