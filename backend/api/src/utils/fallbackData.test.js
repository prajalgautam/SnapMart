import test from 'node:test'
import assert from 'node:assert/strict'

import { getFallbackProducts, getFallbackCategories, getFallbackUser } from './fallbackData.js'

test('fallback products and categories are available without MongoDB', () => {
  const products = getFallbackProducts()
  const categories = getFallbackCategories()
  const user = getFallbackUser()

  assert.ok(Array.isArray(products) && products.length > 0)
  assert.ok(Array.isArray(categories) && categories.length > 0)
  assert.equal(user.email, 'demo@kosheli.local')
})
