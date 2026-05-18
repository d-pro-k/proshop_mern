import React, { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import s from './ProductCarousel.module.css'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/icons'

function formatPrice(value) {
  if (value === null || value === undefined) return '$0.00'
  return '$' + Number(value).toFixed(2)
}

var ProductCarousel = function (props) {
  var products = props.products || []
  var loading = props.loading
  var error = props.error

  var currentState = useState(0)
  var current = currentState[0]
  var setCurrent = currentState[1]

  var sectionRef = useRef(null)

  if (loading) {
    return (
      <section className={s.carousel + ' ' + s.carouselSkeleton} aria-busy='true' aria-label='Loading top rated products' />
    )
  }

  if (error) {
    return null
  }

  if (products.length === 0) {
    return null
  }

  var total = products.length
  var maxIndex = total - 1
  var safeCurrent = Math.min(current, maxIndex)

  function prev() {
    setCurrent(function (i) { return i > 0 ? i - 1 : 0 })
  }
  function next() {
    setCurrent(function (i) { return i < maxIndex ? i + 1 : maxIndex })
  }
  function goTo(i) {
    if (i >= 0 && i <= maxIndex) setCurrent(i)
  }

  function handleKey(e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    else if (e.key === 'Home') { e.preventDefault(); setCurrent(0) }
    else if (e.key === 'End') { e.preventDefault(); setCurrent(maxIndex) }
    else if (e.key === 'Escape') {
      e.preventDefault()
      if (sectionRef.current) sectionRef.current.blur()
    }
  }

  return (
    <section
      className={s.carousel}
      aria-roledescription='carousel'
      aria-label='Top rated products'
      tabIndex={0}
      onKeyDown={handleKey}
      ref={sectionRef}
    >
      <button
        type='button'
        className={s.arrow + ' ' + s.arrowPrev}
        aria-label='Previous slide'
        onClick={prev}
        disabled={safeCurrent === 0}
      >
        <ChevronLeftIcon size={20} />
      </button>

      <div className={s.slides} aria-live='polite'>
        {products.map(function (p, i) {
          var isActive = i === safeCurrent
          return (
            <article
              key={p._id}
              className={isActive ? (s.slide + ' ' + s.slideActive) : s.slide}
              aria-hidden={isActive ? 'false' : 'true'}
              aria-roledescription='slide'
              aria-label={'Slide ' + (i + 1) + ' of ' + total}
            >
              <Link to={'/product/' + p._id} className={s.slideLink}>
                <div className={s.slideImageWrap}>
                  <img src={p.image} alt='' className={s.slideImage} />
                </div>
                <div className={s.slideCaption}>
                  <h2 className={s.slideTitle}>{p.name}</h2>
                  <p className={s.slidePrice}>{formatPrice(p.price)}</p>
                </div>
              </Link>
            </article>
          )
        })}
      </div>

      <button
        type='button'
        className={s.arrow + ' ' + s.arrowNext}
        aria-label='Next slide'
        onClick={next}
        disabled={safeCurrent === maxIndex}
      >
        <ChevronRightIcon size={20} />
      </button>

      {total > 1 && (
        <ol className={s.dots}>
          {products.map(function (p, i) {
            var isActive = i === safeCurrent
            return (
              <li key={p._id}>
                <button
                  type='button'
                  className={isActive ? (s.dot + ' ' + s.dotActive) : s.dot}
                  aria-label={'Go to slide ' + (i + 1)}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={function () { goTo(i) }}
                />
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export default ProductCarousel
