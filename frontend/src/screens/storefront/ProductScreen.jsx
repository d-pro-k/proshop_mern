import React, { useState, useEffect } from 'react'
import { Link, useParams, useHistory } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import s from './ProductScreen.module.css'
import Meta from '../../components/Meta'
import { StarIcon, AlertCircleIcon } from '../../components/icons'
import {
  listProductDetails,
  createProductReview,
} from '../../actions/productActions'
import { PRODUCT_CREATE_REVIEW_RESET } from '../../constants/productConstants'

function starVariant(rating, position) {
  if (rating >= position) return 'full'
  if (rating >= position - 0.5) return 'half'
  return 'empty'
}

function formatPrice(value) {
  if (value === null || value === undefined) return '$0.00'
  return '$' + Number(value).toFixed(2)
}

function formatReviewDate(iso) {
  if (!iso) return ''
  try {
    var d = new Date(iso)
    if (isNaN(d.getTime())) return iso.substring(0, 10)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch (e) {
    return iso.substring(0, 10)
  }
}

var StarRow = function (props) {
  var rating = Number(props.rating) || 0
  var size = props.size || 16
  return (
    <span className={s.stars} aria-hidden='true'>
      {[1, 2, 3, 4, 5].map(function (i) {
        var v = starVariant(rating, i)
        return (
          <span
            key={i}
            className={v === 'empty' ? s.starEmpty : s.starActive}
          >
            <StarIcon size={size} variant={v} />
          </span>
        )
      })}
    </span>
  )
}

var ProductScreen = function () {
  var params = useParams()
  var history = useHistory()
  var dispatch = useDispatch()
  var productId = params.id

  var qtyState = useState(1)
  var qty = qtyState[0]
  var setQty = qtyState[1]

  var ratingState = useState(0)
  var rating = ratingState[0]
  var setRating = ratingState[1]

  var commentState = useState('')
  var comment = commentState[0]
  var setComment = commentState[1]

  var productDetails = useSelector(function (state) { return state.productDetails })
  var loading = productDetails ? productDetails.loading : false
  var error = productDetails ? productDetails.error : null
  var product = (productDetails && productDetails.product) || { reviews: [] }

  var userLogin = useSelector(function (state) { return state.userLogin })
  var userInfo = userLogin && userLogin.userInfo

  var productReviewCreate = useSelector(function (state) { return state.productReviewCreate })
  var successProductReview = productReviewCreate && productReviewCreate.success
  var loadingProductReview = productReviewCreate && productReviewCreate.loading
  var errorProductReview = productReviewCreate && productReviewCreate.error

  useEffect(function () {
    if (successProductReview) {
      // After a successful review submit: reset the form, clear the success flag,
      // and refetch product details so the new review appears in the list without a page reload.
      setRating(0)
      setComment('')
      dispatch({ type: PRODUCT_CREATE_REVIEW_RESET })
      dispatch(listProductDetails(productId))
      return
    }
    if (!product._id || product._id !== productId) {
      dispatch(listProductDetails(productId))
      dispatch({ type: PRODUCT_CREATE_REVIEW_RESET })
    }
  }, [dispatch, productId, successProductReview])

  function addToCartHandler() {
    history.push('/cart/' + productId + '?qty=' + qty)
  }

  function submitHandler(e) {
    e.preventDefault()
    dispatch(createProductReview(productId, { rating: rating, comment: comment }))
  }

  function renderSkeleton() {
    return (
      <div className={s.skeletonHero} aria-busy='true' aria-label='Loading product'>
        <div className={s.skeletonImage} />
        <div className={s.skeletonMeta}>
          <div className={s.skeletonLine + ' ' + s.skeletonLineTitle} />
          <div className={s.skeletonLine + ' ' + s.skeletonLineShort} />
          <div className={s.skeletonLine + ' ' + s.skeletonLineMid} />
          <div className={s.skeletonLine} />
          <div className={s.skeletonLine + ' ' + s.skeletonLineShort} />
        </div>
      </div>
    )
  }

  function renderError(msg) {
    return (
      <div className={s.errorAlert} role='alert'>
        <span className={s.errorIcon}><AlertCircleIcon size={20} /></span>
        <div className={s.errorBody}>
          <div className={s.errorTitle}>Failed to load product</div>
          <div className={s.errorDesc}>
            {msg || 'Could not reach the product service. Check your connection.'}
          </div>
          <button className={s.errorRetry} onClick={function () { window.location.reload() }}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  function renderProduct() {
    var reviews = product.reviews || []
    var inStock = Number(product.countInStock) > 0

    return (
      <>
        <Meta title={product.name} />

        <section className={s.hero}>
          <div className={s.heroImageWrap}>
            <img src={product.image} alt={product.name} className={s.heroImage} />
          </div>

          <div className={s.heroMeta}>
            <h1 className={s.title}>{product.name}</h1>

            <div
              className={s.ratingRow}
              aria-label={Number(product.rating).toFixed(1) + ' out of 5 stars, ' + (product.numReviews || 0) + ' reviews'}
            >
              <StarRow rating={product.rating} size={16} />
              <span className={s.reviewCount}>{product.numReviews || 0} reviews</span>
            </div>

            <div className={s.price}>{formatPrice(product.price)}</div>

            <p className={s.description}>{product.description}</p>

            <div className={s.stock + ' ' + (inStock ? s.stockIn : s.stockOut)}>
              <span className={s.stockDot} aria-hidden='true' />
              {inStock ? 'In stock' : 'Out of stock'}
            </div>

            {inStock && (
              <div className={s.qtyRow}>
                <label className={s.qtyLabel} htmlFor='product-qty'>Quantity</label>
                <select
                  id='product-qty'
                  className={s.qtySelect}
                  value={qty}
                  onChange={function (e) { setQty(Number(e.target.value)) }}
                >
                  {Array.from({ length: Number(product.countInStock) || 0 }, function (_, i) {
                    return (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    )
                  })}
                </select>
              </div>
            )}

            <button
              type='button'
              className={s.addToCart}
              onClick={addToCartHandler}
              disabled={!inStock}
            >
              {inStock ? 'Add to cart' : 'Out of stock'}
            </button>
          </div>
        </section>

        <section className={s.reviewsSection} aria-label='Customer reviews'>
          <header className={s.reviewsHeader}>
            <h2 className={s.reviewsTitle}>Reviews</h2>
            {reviews.length > 0 && (
              <span className={s.reviewsCount}>
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </span>
            )}
          </header>

          {reviews.length === 0 ? (
            <p className={s.noReviews}>No reviews yet. Be the first to write one.</p>
          ) : (
            <ul className={s.reviewsList}>
              {reviews.map(function (review) {
                return (
                  <li key={review._id} className={s.reviewItem}>
                    <div className={s.reviewItemHeader}>
                      <strong className={s.reviewName}>{review.name}</strong>
                      <span className={s.reviewDate}>{formatReviewDate(review.createdAt)}</span>
                    </div>
                    <div
                      className={s.reviewRating}
                      aria-label={Number(review.rating).toFixed(1) + ' out of 5 stars'}
                    >
                      <StarRow rating={review.rating} size={14} />
                    </div>
                    {review.comment && (
                      <p className={s.reviewComment}>{review.comment}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div className={s.reviewForm}>
            <h3 className={s.reviewFormTitle}>Write a customer review</h3>

            {successProductReview && (
              <div className={s.formSuccess} role='status'>Review submitted successfully.</div>
            )}
            {errorProductReview && (
              <div className={s.formError} role='alert'>{errorProductReview}</div>
            )}

            {userInfo ? (
              <form onSubmit={submitHandler} className={s.form}>
                <div className={s.formGroup}>
                  <label className={s.formLabel} htmlFor='review-rating'>Rating</label>
                  <select
                    id='review-rating'
                    className={s.formSelect}
                    value={rating}
                    onChange={function (e) { setRating(Number(e.target.value)) }}
                  >
                    <option value=''>Select…</option>
                    <option value='1'>1 — Poor</option>
                    <option value='2'>2 — Fair</option>
                    <option value='3'>3 — Good</option>
                    <option value='4'>4 — Very good</option>
                    <option value='5'>5 — Excellent</option>
                  </select>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel} htmlFor='review-comment'>Comment</label>
                  <textarea
                    id='review-comment'
                    className={s.formTextarea}
                    rows={4}
                    value={comment}
                    onChange={function (e) { setComment(e.target.value) }}
                    placeholder='Share your thoughts about this product…'
                  />
                </div>

                <button
                  type='submit'
                  className={s.submitBtn}
                  disabled={loadingProductReview || !rating}
                >
                  {loadingProductReview ? 'Submitting…' : 'Submit review'}
                </button>
              </form>
            ) : (
              <div className={s.signInPrompt}>
                Please <Link to='/login'>sign in</Link> to write a review.
              </div>
            )}
          </div>
        </section>
      </>
    )
  }

  return (
    <main className={s.page}>
      <Link to='/' className={s.backLink}>
        <span aria-hidden='true' className={s.backArrow}>←</span>
        Continue shopping
      </Link>

      {loading ? renderSkeleton() : error ? renderError(error) : renderProduct()}
    </main>
  )
}

export default ProductScreen
