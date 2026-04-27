import { calculateOrderPrices as originalCalculateOrderPrices } from './original'
import { calculateOrderPrices as refactoredCalculateOrderPrices } from './refactored'

const implementations = [
  ['original', originalCalculateOrderPrices],
  ['refactored', refactoredCalculateOrderPrices],
]

describe.each(implementations)('%s calculateOrderPrices', (_label, calculateOrderPrices) => {
  test('returns shipping, tax, and total for a normal paid-shipping order', () => {
    expect(
      calculateOrderPrices([
        { price: 10, qty: 2 },
        { price: 15.5, qty: 3 },
      ])
    ).toEqual({
      shippingPrice: 100,
      taxPrice: 9.98,
      totalPrice: 176.48,
    })
  })

  test('returns free shipping when items price is greater than 100', () => {
    expect(
      calculateOrderPrices([
        { price: 60, qty: 1 },
        { price: 50, qty: 1 },
      ])
    ).toEqual({
      shippingPrice: 0,
      taxPrice: 16.5,
      totalPrice: 126.5,
    })
  })

  test('treats an empty order as a shippable order with zero tax', () => {
    expect(calculateOrderPrices([])).toEqual({
      shippingPrice: 100,
      taxPrice: 0,
      totalPrice: 100,
    })
  })

  test('keeps charging shipping when items price is exactly 100', () => {
    // This asserts current buggy behavior. Correct business logic would likely use >= 100.
    expect(
      calculateOrderPrices([
        { price: 40, qty: 1 },
        { price: 30, qty: 2 },
      ])
    ).toEqual({
      shippingPrice: 100,
      taxPrice: 15,
      totalPrice: 215,
    })
  })

  test('coerces numeric strings instead of validating the item payload', () => {
    // This asserts current buggy behavior. Correct behavior would likely reject malformed types.
    expect(
      calculateOrderPrices([
        { price: '19.99', qty: '2' },
        { price: '5', qty: 1 },
      ])
    ).toEqual({
      shippingPrice: 100,
      taxPrice: 6.75,
      totalPrice: 151.73,
    })
  })

  test('keeps flat shipping but returns NaN tax and total for missing quantity', () => {
    // This asserts current buggy behavior. Correct behavior would likely reject the order items.
    const result = calculateOrderPrices([{ price: 10 }])

    expect(result.shippingPrice).toBe(100)
    expect(result.taxPrice).toBeNaN()
    expect(result.totalPrice).toBeNaN()
  })

  test('throws when a null item is passed', () => {
    expect(() => calculateOrderPrices([null])).toThrow(TypeError)
  })
})
