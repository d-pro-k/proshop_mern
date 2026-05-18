import React from 'react'
import { Link } from 'react-router-dom'
import s from './ProductCard.module.css'
import { StarIcon } from '../../components/icons'

function starVariant(rating, position) {
  if (rating >= position) return 'full'
  if (rating >= position - 0.5) return 'half'
  return 'empty'
}

function formatPrice(value) {
  if (value === null || value === undefined) return '$0.00'
  return '$' + Number(value).toFixed(2)
}

var ProductCard = function (props) {
  var product = props.product
  if (!product) return null

  var rating = Number(product.rating) || 0
  var numReviews = Number(product.numReviews) || 0

  return (
    <article className={s.card}>
      <Link
        to={'/product/' + product._id}
        className={s.imageLink}
        aria-label={product.name}
        tabIndex='-1'
      >
        <div className={s.imageWrap}>
          <img src={product.image} alt='' className={s.image} loading='lazy' />
        </div>
      </Link>

      <div className={s.body}>
        <h3 className={s.title}>
          <Link to={'/product/' + product._id} className={s.titleLink}>
            {product.name}
          </Link>
        </h3>

        <div
          className={s.rating}
          aria-label={rating.toFixed(1) + ' out of 5 stars, ' + numReviews + ' reviews'}
        >
          <span className={s.stars} aria-hidden='true'>
            {[1, 2, 3, 4, 5].map(function (i) {
              var v = starVariant(rating, i)
              return (
                <span
                  key={i}
                  className={v === 'empty' ? s.starEmpty : s.starActive}
                >
                  <StarIcon size={14} variant={v} />
                </span>
              )
            })}
          </span>
          <span className={s.reviewCount}>{numReviews}</span>
        </div>

        <p className={s.price}>{formatPrice(product.price)}</p>
      </div>
    </article>
  )
}

export default ProductCard
